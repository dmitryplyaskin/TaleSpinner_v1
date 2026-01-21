import express, { type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { initSse } from "@core/sse/sse";

import {
  branchIdParamsSchema,
  chatIdParamsSchema,
  createBranchBodySchema,
  createMessageBodySchema,
  listMessagesQuerySchema,
} from "../chat-core/schemas";
import { initDb } from "../db/client";
import { chatMessages } from "../db/schema";
import {
  activateBranch,
  createAssistantMessageWithVariant,
  createChatBranch,
  createChatMessage,
  getChatById,
  listChatBranches,
  listChatMessages,
  softDeleteChat,
} from "../services/chat-core/chats-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import {
  createGeneration,
  finishGeneration,
  getGenerationById,
  getLatestGenerationForPipelineRun,
  updateGenerationPromptData,
} from "../services/chat-core/generations-repository";
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
import {
  createMessageTransformVariant,
  createRawUserInputVariant,
} from "../services/chat-core/message-variants-repository";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";

const router = express.Router();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_PIPELINE_ID = "builtin:default_v1";
const DEFAULT_PIPELINE_NAME = "default";

router.get(
  "/chats/:id",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    return { data: chat };
  })
);

router.delete(
  "/chats/:id",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    const deleted = await softDeleteChat(params.id);
    return { data: deleted };
  })
);

router.get(
  "/chats/:id/branches",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");
    const branches = await listChatBranches({ chatId: params.id });
    return { data: branches };
  })
);

router.post(
  "/chats/:id/branches",
  validate({ params: chatIdParamsSchema, body: createBranchBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const parentBranchId =
      req.body.parentBranchId ??
      (typeof req.body.forkedFromMessageId === "string"
        ? chat.activeBranchId ?? undefined
        : undefined);

    if (typeof req.body.forkedFromMessageId === "string") {
      if (!parentBranchId) {
        throw new HttpError(
          400,
          "parentBranchId обязателен для fork (нет activeBranchId)",
          "VALIDATION_ERROR"
        );
      }
      const db = await initDb();
      const forkRows = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.chatId, params.id),
            eq(chatMessages.branchId, parentBranchId),
            eq(chatMessages.id, req.body.forkedFromMessageId)
          )
        )
        .limit(1);
      if (!forkRows[0]) {
        throw new HttpError(404, "forkedFromMessageId не найден", "NOT_FOUND");
      }
    }

    const branch = await createChatBranch({
      ownerId: req.body.ownerId,
      chatId: params.id,
      title: req.body.title,
      parentBranchId,
      forkedFromMessageId: req.body.forkedFromMessageId,
      forkedFromVariantId: req.body.forkedFromVariantId,
      meta: req.body.meta,
    });

    return { data: branch };
  })
);

router.post(
  "/chats/:id/branches/:branchId/activate",
  validate({ params: branchIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string; branchId: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branches = await listChatBranches({ chatId: params.id });
    const exists = branches.some((b) => b.id === params.branchId);
    if (!exists) throw new HttpError(404, "Branch не найден", "NOT_FOUND");

    const updated = await activateBranch({
      chatId: params.id,
      branchId: params.branchId,
    });
    return { data: updated };
  })
);

router.get(
  "/chats/:id/messages",
  validate({ params: chatIdParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = req.query as unknown as { branchId?: string; limit: number; before?: number };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branchId = query.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    const messages = await listChatMessages({
      chatId: params.id,
      branchId,
      limit: query.limit,
      before: query.before,
    });
    return { data: { branchId, messages } };
  })
);

router.post(
  "/chats/:id/messages",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const accept = String(req.headers.accept ?? "");
    const wantsSse = accept.includes("text/event-stream");

    if (!wantsSse) {
      const body = createMessageBodySchema.parse(req.body);

      const branchId = body.branchId || chat.activeBranchId;
      if (!branchId) {
        throw new HttpError(
          400,
          "branchId обязателен (нет activeBranchId)",
          "VALIDATION_ERROR"
        );
      }

      if (body.role === "assistant") {
        throw new HttpError(
          400,
          "role=assistant запрещён в этом endpoint (v1)",
          "VALIDATION_ERROR"
        );
      }

      const message = await createChatMessage({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        promptText: body.promptText,
        format: body.format,
        blocks: body.blocks,
        meta: body.meta,
      });

      return { data: message };
    }

    // SSE mode: save user message + run generation
    const sseBodySchema = createMessageBodySchema.extend({
      settings: z.record(z.string(), z.unknown()).optional().default({}),
      requestId: z.string().min(1).optional(),
      messageTransform: z
        .object({
          promptText: z.string().min(1),
          label: z.string().min(1).optional(),
        })
        .optional(),
    });

    const body = sseBodySchema.parse(req.body);

    const branchId = body.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    if (body.role === "assistant") {
      throw new HttpError(
        400,
        "role=assistant запрещён в этом endpoint (v1)",
        "VALIDATION_ERROR"
      );
    }

    // NOTE: for SSE we must take over the response; asyncHandler will not auto-send.
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
      const ownerId = body.ownerId ?? "global";
      const activeProfile = await resolveActivePipelineProfile({
        ownerId,
        chatId: params.id,
        entityProfileId: chat.entityProfileId,
      });
      const idempotencyKey =
        typeof body.requestId === "string" && body.requestId.trim()
          ? `user_message:${branchId}:${body.requestId.trim()}`
          : null;

      if (idempotencyKey) {
        const ensured = await ensurePipelineRun({
          ownerId,
          chatId: params.id,
          entityProfileId: chat.entityProfileId,
          trigger: "user_message",
          idempotencyKey,
          branchId,
          activeProfileId: activeProfile.profileId,
          activeProfileVersion: activeProfile.profileVersion,
          meta: {
            branchId,
            requestId: body.requestId,
            mode: "user_message",
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

          const env = {
            chatId: params.id,
            branchId: ensured.run.branchId ?? branchId,
            trigger: "user_message" as const,
            pipelineId: DEFAULT_PIPELINE_ID,
            pipelineName: DEFAULT_PIPELINE_NAME,
            activeProfileId: ensured.run.activeProfileId ?? null,
            activeProfileVersion: ensured.run.activeProfileVersion ?? null,
            profileSource: (activeProfile.source === "none" ? null : activeProfile.source),
            runId: ensured.run.id,
            pipelineRunId: ensured.run.id,
            stepRunId: gen?.pipelineStepRunId ?? null,
            pipelineStepRunId: gen?.pipelineStepRunId ?? null,
            stepType: gen?.pipelineStepRunId ? ("llm" as const) : null,
            generationId: gen?.id ?? ensured.run.generationId ?? null,
            userMessageId: ensured.run.userMessageId ?? null,
            assistantMessageId: ensured.run.assistantMessageId ?? null,
            assistantVariantId: ensured.run.assistantVariantId ?? gen?.variantId ?? null,
            variantId: ensured.run.assistantVariantId ?? gen?.variantId ?? "",
          };

          // Best-effort: inform UI about existing ids.
          sse.send("llm.stream.meta", env);

          if (gen && gen.status === "streaming") {
            sse.send("llm.stream.error", {
              ...env,
              code: "pipeline_idempotency_conflict",
              message: "user_message уже выполняется",
            });
            return;
          }

          if (gen) {
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
            ...env,
            code: "pipeline_idempotency_conflict",
            message: "user_message уже выполняется",
          });
          return;
        }
      }

      const userMessage = await createChatMessage({
        ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        promptText: body.promptText,
        format: body.format,
        blocks: body.blocks,
        meta: body.meta,
      });

      const assistant = await createAssistantMessageWithVariant({
        ownerId,
        chatId: params.id,
        branchId,
      });

      if (pipelineRunId) {
        await updatePipelineRunCorrelation({
          id: pipelineRunId,
          userMessageId: userMessage.id,
          assistantMessageId: assistant.assistantMessageId,
          assistantVariantId: assistant.variantId,
        });
      } else {
        const pipelineRun = await createPipelineRun({
          ownerId,
          chatId: params.id,
          entityProfileId: chat.entityProfileId,
          trigger: "user_message",
          branchId,
          userMessageId: userMessage.id,
          assistantMessageId: assistant.assistantMessageId,
          assistantVariantId: assistant.variantId,
          activeProfileId: activeProfile.profileId,
          activeProfileVersion: activeProfile.profileVersion,
          meta: {
            branchId,
            userMessageId: userMessage.id,
            assistantMessageId: assistant.assistantMessageId,
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
        input: { chatId: params.id, branchId },
      });
      preStepRunId = preStep.id;

      // Optional v1: message_transform for the *current* user message only.
      // Implemented via variants so prompt assembly still reads selected `promptText`.
      let messageTransformInfo:
        | { rawVariantId: string; transformedVariantId: string; label: string | null }
        | null = null;
      if (body.messageTransform) {
        if (body.role !== "user") {
          throw new HttpError(
            400,
            "messageTransform разрешён только для role=user (v1)",
            "VALIDATION_ERROR"
          );
        }

        const raw = String(body.promptText ?? "");
        const transformed = String(body.messageTransform.promptText ?? "").trim();
        if (!transformed) {
          throw new HttpError(400, "messageTransform.promptText пустой", "VALIDATION_ERROR");
        }

        const rawVariant = await createRawUserInputVariant({
          ownerId,
          messageId: userMessage.id,
          promptText: raw,
          meta: { source: "user_message", createdBy: "pipeline.pre" },
        });

        const transformedVariant = await createMessageTransformVariant({
          ownerId,
          messageId: userMessage.id,
          promptText: transformed,
          meta: {
            source: "message_transform",
            label: body.messageTransform.label ?? null,
            createdBy: "pipeline.pre",
          },
        });

        messageTransformInfo = {
          rawVariantId: rawVariant.id,
          transformedVariantId: transformedVariant.id,
          label: body.messageTransform.label ?? null,
        };
      }

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
      let templateId: string | null = null;
      try {
        const [template, context] = await Promise.all([
          pickActivePromptTemplate({
            ownerId,
            chatId: params.id,
            entityProfileId: chat.entityProfileId,
          }),
          buildPromptTemplateRenderContext({
            ownerId,
            chatId: params.id,
            branchId,
            historyLimit: 50,
            excludeMessageIds: [assistant.assistantMessageId],
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
        chatId: params.id,
        branchId,
        systemPrompt,
        historyLimit: 50,
        excludeMessageIds: [assistant.assistantMessageId],
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
          messageTransform: messageTransformInfo,
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
        chatId: params.id,
        branchId,
        messageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
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
        chatId: params.id,
        branchId,
        trigger: "user_message" as const,
        pipelineId: DEFAULT_PIPELINE_ID,
        pipelineName: DEFAULT_PIPELINE_NAME,
        activeProfileId: activeProfile.profileId,
        activeProfileVersion: activeProfile.profileVersion,
        profileSource: activeProfile.source === "none" ? null : activeProfile.source,
        runId: pipelineRunId,
        pipelineRunId,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        assistantVariantId: assistant.variantId,
        variantId: assistant.variantId,
        generationId,
      };

      sse.send("pipeline.run.started", {
        ...baseEnv,
        status: "running",
      });

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
        chatId: params.id,
        branchId,
        entityProfileId: chat.entityProfileId,
        systemPrompt,
        promptMessages: builtPrompt.llmMessages,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
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

      // Finalize pipeline run logging.
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
            chatId: params.id,
            assistantMessageId: assistant.assistantMessageId,
            assistantVariantId: assistant.variantId,
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
        chatId: params.id,
        branchId,
        trigger: "user_message" as const,
        pipelineId: DEFAULT_PIPELINE_ID,
        pipelineName: DEFAULT_PIPELINE_NAME,
        runId: pipelineRunId,
        pipelineRunId,
        stepRunId: llmStepRunId ?? preStepRunId ?? postStepRunId,
        pipelineStepRunId: llmStepRunId ?? preStepRunId ?? postStepRunId,
        stepType: llmStepRunId ? ("llm" as const) : preStepRunId ? ("pre" as const) : postStepRunId ? ("post" as const) : null,
        generationId,
      };

      sse.send("llm.stream.error", { ...errEnv, ...clientErr });
      sse.send("pipeline.run.error", {
        ...errEnv,
        status: "error",
        error: clientErr,
      });
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
            meta: { branchId, generationId, status: "error", errorCode: clientErr.code },
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

