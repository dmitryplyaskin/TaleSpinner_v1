import express, { type Request, type Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { initSse } from "@core/sse/sse";

import {
  messageIdParamsSchema,
  createManualEditVariantBodySchema,
  selectVariantParamsSchema,
} from "../chat-core/schemas";
import { initDb } from "../db/client";
import { chatMessages } from "../db/schema";
import {
  getChatById,
} from "../services/chat-core/chats-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import {
  createGeneration,
  finishGeneration,
  getGenerationById,
  getLatestGenerationForPipelineRun,
  updateGenerationPromptData,
} from "../services/chat-core/generations-repository";
import {
  createVariantForRegenerate,
  createManualEditVariant,
  listMessageVariants,
  selectMessageVariant,
} from "../services/chat-core/message-variants-repository";
import { getRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";
import { normalizePipelineErrorForClient } from "@core/errors/pipeline-errors";
import { resolveActivePipelineProfile } from "../services/chat-core/pipeline-profile-resolver";
import {
  createPipelineRun,
  ensurePipelineRun,
  finishPipelineRun,
  updatePipelineRunCorrelation,
} from "../services/chat-core/pipeline-runs-repository";
import {
  createPipelineStepRun,
  finishPipelineStepRun,
} from "../services/chat-core/pipeline-step-runs-repository";
import { buildPromptDraft } from "../services/chat-core/prompt-draft-builder";
import { runPostProcessing } from "../services/chat-core/post-processing";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";

const router = express.Router();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_PIPELINE_ID = "builtin:default_v1";
const DEFAULT_PIPELINE_NAME = "default";

router.get(
  "/messages/:id/variants",
  validate({ params: messageIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const variants = await listMessageVariants({ messageId: params.id });
    return { data: variants };
  })
);

router.post(
  "/messages/:id/variants",
  validate({ params: messageIdParamsSchema, body: createManualEditVariantBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = createManualEditVariantBodySchema.parse(req.body);

    const db = await initDb();
    const msgRows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, params.id))
      .limit(1);
    const msg = msgRows[0];
    if (!msg) throw new HttpError(404, "Message не найден", "NOT_FOUND");
    if (msg.role !== "assistant") {
      throw new HttpError(
        400,
        "manual_edit поддерживается только для role=assistant (v1)",
        "VALIDATION_ERROR"
      );
    }

    const created = await createManualEditVariant({
      ownerId: body.ownerId,
      messageId: params.id,
      promptText: body.promptText,
      blocks: body.blocks,
      meta: body.meta,
    });

    return { data: created };
  })
);

router.post(
  "/messages/:id/variants/:variantId/select",
  validate({ params: selectVariantParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; variantId: string };
    const selected = await selectMessageVariant({
      messageId: params.id,
      variantId: params.variantId,
    });
    if (!selected) throw new HttpError(404, "Variant не найден", "NOT_FOUND");
    return { data: selected };
  })
);

const regenerateBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  requestId: z.string().min(1).optional(),
});

router.post(
  "/messages/:id/regenerate",
  validate({ params: messageIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    const accept = String(req.headers.accept ?? "");
    const wantsSse = accept.includes("text/event-stream");
    if (!wantsSse) {
      throw new HttpError(406, "Нужен Accept: text/event-stream", "NOT_ACCEPTABLE");
    }

    const body = regenerateBodySchema.parse(req.body);
    const ownerId = body.ownerId ?? "global";

    const db = await initDb();
    const msgRows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, params.id));
    const msg = msgRows[0];
    if (!msg) throw new HttpError(404, "Message не найден", "NOT_FOUND");
    if (msg.role !== "assistant") {
      throw new HttpError(400, "regenerate поддерживается только для role=assistant", "VALIDATION_ERROR");
    }

    // v1 guard: allow regenerate only for the last message in the branch (simpler semantics).
    const lastRows = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(and(eq(chatMessages.chatId, msg.chatId), eq(chatMessages.branchId, msg.branchId)))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(1);
    const lastId = lastRows[0]?.id ?? null;
    if (lastId !== msg.id) {
      throw new HttpError(400, "regenerate разрешён только для последнего сообщения в ветке (v1)", "VALIDATION_ERROR");
    }

    const chat = await getChatById(msg.chatId);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branchId = msg.branchId;

    // Take over the response; asyncHandler will not auto-send.
    const sse = initSse({ res });

    let generationId: string | null = null;
    let pipelineRunId: string | null = null;
    let llmStepRunId: string | null = null;
    let preStepRunId: string | null = null;
    let postStepRunId: string | null = null;
    let preStepFinished = false;
    let postStepFinished = false;

    const sendStepStarted = (params: {
      baseEnv: Record<string, unknown>;
      stepRunId: string;
      stepType: "pre" | "llm" | "post";
      label?: string;
    }) => {
      sse.send("pipeline.step.started", {
        ...params.baseEnv,
        stepRunId: params.stepRunId,
        pipelineStepRunId: params.stepRunId,
        stepType: params.stepType,
        status: "running",
        ...(params.label ? { label: params.label } : {}),
      });
    };

    const sendStepDone = (params: {
      baseEnv: Record<string, unknown>;
      stepRunId: string;
      stepType: "pre" | "llm" | "post";
      status: "done" | "aborted" | "error" | "skipped";
      error?: { code: string; message: string } | null;
      label?: string;
    }) => {
      sse.send("pipeline.step.done", {
        ...params.baseEnv,
        stepRunId: params.stepRunId,
        pipelineStepRunId: params.stepRunId,
        stepType: params.stepType,
        status: params.status,
        ...(params.label ? { label: params.label } : {}),
        ...(params.error ? { error: params.error } : {}),
      });
    };
    const runAbortController = new AbortController();
    let shouldAbortOnClose = false;
    let reqClosed = false;
    req.on("close", () => {
      reqClosed = true;
      if (shouldAbortOnClose) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }
      sse.close();
    });
    try {
      const idempotencyKey =
        typeof body.requestId === "string" && body.requestId.trim()
          ? `regenerate:${msg.id}:${body.requestId.trim()}`
          : null;

      const activeProfile = await resolveActivePipelineProfile({
        ownerId,
        chatId: msg.chatId,
        entityProfileId: chat.entityProfileId,
      });

      if (idempotencyKey) {
        const ensured = await ensurePipelineRun({
          ownerId,
          chatId: msg.chatId,
          entityProfileId: chat.entityProfileId,
          trigger: "regenerate",
          idempotencyKey,
          branchId,
          assistantMessageId: msg.id,
          activeProfileId: activeProfile.profileId,
          activeProfileVersion: activeProfile.profileVersion,
          meta: {
            branchId,
            assistantMessageId: msg.id,
            requestId: body.requestId,
            mode: "regenerate",
            pipelineId: DEFAULT_PIPELINE_ID,
            pipelineName: DEFAULT_PIPELINE_NAME,
            profileSource: activeProfile.source,
            activeProfileId: activeProfile.profileId,
            activeProfileVersion: activeProfile.profileVersion,
          },
        });

        pipelineRunId = ensured.run.id;

        if (!ensured.created) {
          const gen =
            ensured.run.generationId
              ? await getGenerationById(ensured.run.generationId)
              : await getLatestGenerationForPipelineRun({ pipelineRunId: ensured.run.id });

          if (gen && gen.id) {
            const env = {
              chatId: msg.chatId,
              branchId,
              trigger: "regenerate" as const,
              pipelineId: DEFAULT_PIPELINE_ID,
              pipelineName: DEFAULT_PIPELINE_NAME,
              activeProfileId: ensured.run.activeProfileId ?? null,
              activeProfileVersion: ensured.run.activeProfileVersion ?? null,
              profileSource: (activeProfile.source === "none" ? null : activeProfile.source),
              runId: ensured.run.id,
              pipelineRunId: ensured.run.id,
              stepRunId: gen.pipelineStepRunId ?? null,
              pipelineStepRunId: gen.pipelineStepRunId ?? null,
              stepType: gen.pipelineStepRunId ? ("llm" as const) : null,
              generationId: gen.id,
              userMessageId: null,
              assistantMessageId: msg.id,
              assistantVariantId: ensured.run.assistantVariantId ?? gen.variantId ?? null,
              variantId: ensured.run.assistantVariantId ?? gen.variantId ?? "",
            };

            // Best-effort: inform UI about existing ids.
            sse.send("llm.stream.meta", env);

            if (gen.status === "streaming") {
              sse.send("llm.stream.error", {
                ...env,
                code: "pipeline_idempotency_conflict",
                message: "regenerate уже выполняется",
              });
              return;
            }

            sse.send("llm.stream.done", {
              ...env,
              status:
                gen.status === "aborted"
                  ? "aborted"
                  : gen.status === "error"
                    ? "error"
                    : "done",
            });
            return;
          }

          sse.send("llm.stream.error", {
            chatId: msg.chatId,
            branchId,
            trigger: "regenerate",
            pipelineId: DEFAULT_PIPELINE_ID,
            pipelineName: DEFAULT_PIPELINE_NAME,
            runId: ensured.run.id,
            pipelineRunId: ensured.run.id,
            code: "pipeline_idempotency_conflict",
            message: "regenerate уже выполняется",
          });
          return;
        }
      }

      const variant = await createVariantForRegenerate({
        ownerId,
        messageId: msg.id,
      });

      if (pipelineRunId) {
        await updatePipelineRunCorrelation({
          id: pipelineRunId,
          assistantVariantId: variant.id,
        });
      } else {
        const pipelineRun = await createPipelineRun({
          ownerId,
          chatId: msg.chatId,
          entityProfileId: chat.entityProfileId,
          trigger: "regenerate",
          branchId,
          assistantMessageId: msg.id,
          assistantVariantId: variant.id,
          activeProfileId: activeProfile.profileId,
          activeProfileVersion: activeProfile.profileVersion,
          meta: {
            branchId,
            assistantMessageId: msg.id,
            regeneratedVariantId: variant.id,
            pipelineId: DEFAULT_PIPELINE_ID,
            pipelineName: DEFAULT_PIPELINE_NAME,
            profileSource: activeProfile.source,
            activeProfileId: activeProfile.profileId,
            activeProfileVersion: activeProfile.profileVersion,
          },
        });
        pipelineRunId = pipelineRun.id;
      }

      // PRE step: pick template + render system prompt
      const preStep = await createPipelineStepRun({
        ownerId,
        runId: pipelineRunId,
        stepName: "pre",
        stepType: "pre",
        input: { chatId: msg.chatId, branchId, mode: "regenerate", messageId: msg.id },
      });
      preStepRunId = preStep.id;

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
      let templateId: string | null = null;
      try {
        const [template, context] = await Promise.all([
          pickActivePromptTemplate({
            ownerId,
            chatId: msg.chatId,
            entityProfileId: chat.entityProfileId,
          }),
          buildPromptTemplateRenderContext({
            ownerId,
            chatId: msg.chatId,
            branchId,
            historyLimit: 50,
            excludeMessageIds: [msg.id],
          }),
        ]);

        if (template) templateId = template.id;
        if (template) {
          const rendered = await renderLiquidTemplate({
            templateText: template.templateText,
            context,
          });
          const normalized = rendered.trim();
          if (normalized) systemPrompt = normalized;
        }
      } catch {
        // Keep fallback prompt on any pre-step failure.
      }

      const builtPrompt = await buildPromptDraft({
        ownerId,
        chatId: msg.chatId,
        branchId,
        systemPrompt,
        historyLimit: 50,
        excludeMessageIds: [msg.id],
        activeProfileSpec: activeProfile.profile?.spec ?? null,
      });

      await finishPipelineStepRun({
        id: preStep.id,
        status: "done",
        output: {
          templateId,
          promptHash: builtPrompt.promptHash,
          trimming: builtPrompt.trimming,
          // Redacted snapshot is also stored on Generation; keeping it here enables reconstruction
          // from step logs alone (useful if generation record is missing/incomplete).
          promptSnapshot: builtPrompt.promptSnapshot,
          artifactInclusions: builtPrompt.artifactInclusions,
          snapshot: {
            truncated: builtPrompt.promptSnapshot.truncated,
            messageCount: builtPrompt.promptSnapshot.messages.length,
          },
        },
      });
      preStepFinished = true;

      const runtime = await getRuntimeInfo({ ownerId });

      const llmStep = await createPipelineStepRun({
        ownerId,
        runId: pipelineRunId,
        stepName: "llm",
        stepType: "llm",
        input: { providerId: runtime.providerId, model: runtime.model, settings: body.settings },
      });
      llmStepRunId = llmStep.id;

      const createdGen = await createGeneration({
        ownerId,
        chatId: msg.chatId,
        branchId,
        messageId: msg.id,
        variantId: variant.id,
        pipelineRunId,
        pipelineStepRunId: llmStepRunId,
        providerId: runtime.providerId,
        model: runtime.model,
        settings: body.settings,
      });
      generationId = createdGen.id;
      if (pipelineRunId) {
        await updatePipelineRunCorrelation({ id: pipelineRunId, generationId });
      }

      await updateGenerationPromptData({
        id: generationId,
        promptHash: builtPrompt.promptHash,
        promptSnapshot: builtPrompt.promptSnapshot,
      });

      shouldAbortOnClose = true;
      if (reqClosed) {
        runAbortController.abort();
        if (generationId) abortGeneration(generationId);
      }

      const baseEnv = {
        chatId: msg.chatId,
        branchId,
        trigger: "regenerate" as const,
        pipelineId: DEFAULT_PIPELINE_ID,
        pipelineName: DEFAULT_PIPELINE_NAME,
        activeProfileId: activeProfile.profileId,
        activeProfileVersion: activeProfile.profileVersion,
        profileSource: activeProfile.source === "none" ? null : activeProfile.source,
        runId: pipelineRunId,
        pipelineRunId,
        userMessageId: null as null,
        assistantMessageId: msg.id,
        assistantVariantId: variant.id,
        variantId: variant.id,
        generationId,
      };

      sse.send("pipeline.run.started", { ...baseEnv, status: "running" });

      // Step progress events (v1): pre is already finished by now; emit for UI/debug parity.
      if (preStepRunId) {
        sendStepStarted({ baseEnv, stepRunId: preStepRunId, stepType: "pre" });
        sendStepDone({ baseEnv, stepRunId: preStepRunId, stepType: "pre", status: "done" });
      }

      if (llmStepRunId) {
        sendStepStarted({ baseEnv, stepRunId: llmStepRunId, stepType: "llm" });
      }

      sse.send("llm.stream.meta", {
        ...baseEnv,
        stepRunId: llmStepRunId,
        pipelineStepRunId: llmStepRunId,
        stepType: "llm",
      });

      let finalStatus: "done" | "aborted" | "error" = "done";
      let lastGenerationErrorMessage: string | null = null;
      for await (const evt of runChatGeneration({
        ownerId,
        generationId,
        chatId: msg.chatId,
        branchId,
        entityProfileId: chat.entityProfileId,
        systemPrompt,
        promptMessages: builtPrompt.llmMessages,
        assistantMessageId: msg.id,
        variantId: variant.id,
        settings: body.settings,
        abortController: runAbortController,
      })) {
        if (evt.type === "llm.stream.done") {
          finalStatus = evt.data.status;
        }
        if (evt.type === "llm.stream.delta") {
          sse.send("llm.stream.delta", {
            ...baseEnv,
            stepRunId: llmStepRunId,
            pipelineStepRunId: llmStepRunId,
            stepType: "llm",
            generationId,
            ...evt.data,
          });
          continue;
        }
        if (evt.type === "llm.stream.error") {
          lastGenerationErrorMessage = evt.data.message;
          sse.send("llm.stream.error", {
            ...baseEnv,
            stepRunId: llmStepRunId,
            pipelineStepRunId: llmStepRunId,
            stepType: "llm",
            generationId,
            code: "pipeline_generation_error",
            ...evt.data,
          });
          continue;
        }
        sse.send("llm.stream.done", {
          ...baseEnv,
          stepRunId: llmStepRunId,
          pipelineStepRunId: llmStepRunId,
          stepType: "llm",
          generationId,
          ...evt.data,
        });
      }

      if (llmStepRunId) {
        await finishPipelineStepRun({
          id: llmStepRunId,
          status:
            finalStatus === "aborted"
              ? "aborted"
              : finalStatus === "error"
                ? "error"
                : "done",
          output: { status: finalStatus, generationId },
          error: finalStatus === "error" ? "pipeline_generation_error" : null,
        });
        sendStepDone({
          baseEnv,
          stepRunId: llmStepRunId,
          stepType: "llm",
          status:
            finalStatus === "aborted"
              ? "aborted"
              : finalStatus === "error"
                ? "error"
                : "done",
          error:
            finalStatus === "error"
              ? {
                  code: "pipeline_generation_error",
                  message: lastGenerationErrorMessage ?? "Generation error",
                }
              : null,
        });
      }
      const postStep = await createPipelineStepRun({
        ownerId,
        runId: pipelineRunId,
        stepName: "post",
        stepType: "post",
        input: { status: finalStatus, generationId },
      });
      postStepRunId = postStep.id;
      sendStepStarted({ baseEnv, stepRunId: postStepRunId, stepType: "post" });
      let postStatus: "done" | "skipped" | "error" = "skipped";
      let postError: { code: string; message: string } | null = null;
      let postOutput: unknown = { skipped: true, reason: finalStatus };

      if (finalStatus !== "done") {
        await finishPipelineStepRun({
          id: postStep.id,
          status: "skipped",
          output: postOutput,
          error: null,
        });
        postStepFinished = true;
        sendStepDone({ baseEnv, stepRunId: postStepRunId, stepType: "post", status: "skipped" });
      } else {
        try {
          const post = await runPostProcessing({
            ownerId,
            chatId: msg.chatId,
            assistantMessageId: msg.id,
            assistantVariantId: variant.id,
            activeProfileSpec: activeProfile.profile?.spec ?? null,
          });
          postStatus = "done";
          postOutput = {
            status: "done",
            blocks: { count: post.blocks.length },
            stateWrites: post.stateWrites,
          };
          await finishPipelineStepRun({
            id: postStep.id,
            status: "done",
            output: postOutput,
            error: null,
          });
          postStepFinished = true;
          sendStepDone({ baseEnv, stepRunId: postStepRunId, stepType: "post", status: "done" });
        } catch (err) {
          const clientErr = normalizePipelineErrorForClient(err);
          postStatus = "error";
          postError = { code: clientErr.code, message: clientErr.message };
          postOutput = { status: "error", error: clientErr };
          await finishPipelineStepRun({
            id: postStep.id,
            status: "error",
            output: postOutput,
            error: clientErr.code,
          });
          postStepFinished = true;
          sendStepDone({
            baseEnv,
            stepRunId: postStepRunId,
            stepType: "post",
            status: "error",
            error: postError,
          });
        }
      }

      const runFinalStatus =
        postStatus === "error"
          ? "error"
          : finalStatus === "aborted"
            ? "aborted"
            : finalStatus === "error"
              ? "error"
              : "done";

      if (pipelineRunId) {
        await finishPipelineRun({
          id: pipelineRunId,
          status: runFinalStatus,
          meta: {
            branchId,
            generationId,
            status: runFinalStatus,
            llmStatus: finalStatus,
            postStatus,
            postError,
            mode: "regenerate",
          },
        });
      }

      if (runFinalStatus === "done") {
        sse.send("pipeline.run.done", { ...baseEnv, status: "done" });
      } else if (runFinalStatus === "aborted") {
        sse.send("pipeline.run.aborted", { ...baseEnv, status: "aborted" });
      } else {
        sse.send("pipeline.run.error", {
          ...baseEnv,
          status: "error",
          error: {
            code: postError?.code ?? "pipeline_generation_error",
            message: postError?.message ?? lastGenerationErrorMessage ?? "Generation error",
          },
        });
      }
    } catch (error) {
      const clientErr = normalizePipelineErrorForClient(error);
      const errEnv = {
        chatId: msg.chatId,
        branchId,
        trigger: "regenerate" as const,
        pipelineId: DEFAULT_PIPELINE_ID,
        pipelineName: DEFAULT_PIPELINE_NAME,
        runId: pipelineRunId,
        pipelineRunId,
        stepRunId: llmStepRunId ?? preStepRunId ?? postStepRunId,
        pipelineStepRunId: llmStepRunId ?? preStepRunId ?? postStepRunId,
        stepType: llmStepRunId ? ("llm" as const) : preStepRunId ? ("pre" as const) : postStepRunId ? ("post" as const) : null,
        generationId,
        userMessageId: null as null,
        assistantMessageId: msg.id,
      };

      sse.send("llm.stream.error", { ...errEnv, ...clientErr });
      sse.send("pipeline.run.error", { ...errEnv, status: "error", error: clientErr });
      try {
        if (generationId) {
          await finishGeneration({
            id: generationId,
            status: "error",
            error: clientErr.message,
          });
        }
        if (preStepRunId && !preStepFinished) {
          await finishPipelineStepRun({
            id: preStepRunId,
            status: "error",
            output: { status: "error" },
            error: clientErr.code,
          });
        }
        if (llmStepRunId) {
          await finishPipelineStepRun({
            id: llmStepRunId,
            status: "error",
            output: { status: "error", generationId },
            error: clientErr.code,
          });
        }
        if (postStepRunId && !postStepFinished) {
          await finishPipelineStepRun({
            id: postStepRunId,
            status: "error",
            output: { status: "error", generationId },
            error: clientErr.code,
          });
        }
        if (pipelineRunId) {
          await finishPipelineRun({
            id: pipelineRunId,
            status: "error",
            meta: { branchId, generationId, status: "error", errorCode: clientErr.code, mode: "regenerate" },
          });
        }
      } catch {
        // ignore secondary errors
      }
    } finally {
      sse.close();
    }

    return;
  })
);

export default router;

