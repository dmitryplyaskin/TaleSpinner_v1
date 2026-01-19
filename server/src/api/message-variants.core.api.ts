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
  listMessagesForPrompt,
} from "../services/chat-core/chats-repository";
import { abortGeneration } from "../services/chat-core/generation-runtime";
import { createGeneration } from "../services/chat-core/generations-repository";
import {
  createVariantForRegenerate,
  createManualEditVariant,
  listMessageVariants,
  selectMessageVariant,
} from "../services/chat-core/message-variants-repository";
import { getRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";
import { createPipelineRun, finishPipelineRun } from "../services/chat-core/pipeline-runs-repository";
import {
  createPipelineStepRun,
  finishPipelineStepRun,
} from "../services/chat-core/pipeline-step-runs-repository";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";
import { getEntityProfileById } from "../services/chat-core/entity-profiles-repository";

const router = express.Router();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

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
    try {
      const variant = await createVariantForRegenerate({
        ownerId,
        messageId: msg.id,
      });

      const pipelineRun = await createPipelineRun({
        ownerId,
        chatId: msg.chatId,
        entityProfileId: chat.entityProfileId,
        trigger: "manual",
        meta: { branchId, assistantMessageId: msg.id, regeneratedVariantId: variant.id },
      });
      pipelineRunId = pipelineRun.id;

      // PRE step: pick template + render system prompt
      const preStep = await createPipelineStepRun({
        ownerId,
        runId: pipelineRunId,
        stepName: "pre",
        stepType: "pre",
        input: { chatId: msg.chatId, branchId, mode: "regenerate", messageId: msg.id },
      });

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
      let templateId: string | null = null;
      try {
        const [entityProfile, template, history] = await Promise.all([
          getEntityProfileById(chat.entityProfileId),
          pickActivePromptTemplate({
            ownerId,
            chatId: msg.chatId,
            entityProfileId: chat.entityProfileId,
          }),
          listMessagesForPrompt({
            chatId: msg.chatId,
            branchId,
            limit: 50,
            excludeMessageIds: [msg.id],
          }),
        ]);

        if (template) templateId = template.id;
        if (template && entityProfile) {
          const rendered = await renderLiquidTemplate({
            templateText: template.templateText,
            context: {
              char: entityProfile.spec,
              user: {},
              chat: {
                id: msg.chatId,
                title: chat.title,
                branchId,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
              },
              messages: history.map((m) => ({ role: m.role, content: m.content })),
              rag: {},
              now: new Date().toISOString(),
            },
          });
          const normalized = rendered.trim();
          if (normalized) systemPrompt = normalized;
        }
      } catch {
        // Keep fallback prompt on any pre-step failure.
      }

      await finishPipelineStepRun({
        id: preStep.id,
        status: "done",
        output: { templateId, systemPrompt },
      });

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
        messageId: msg.id,
        variantId: variant.id,
        pipelineRunId,
        pipelineStepRunId: llmStepRunId,
        providerId: runtime.providerId,
        model: runtime.model,
        settings: body.settings,
      });
      generationId = createdGen.id;

      // Close on disconnect and propagate abort.
      req.on("close", () => {
        if (generationId) abortGeneration(generationId);
        sse.close();
      });

      sse.send("llm.stream.meta", {
        chatId: msg.chatId,
        branchId,
        userMessageId: null,
        assistantMessageId: msg.id,
        variantId: variant.id,
        generationId,
        pipelineRunId,
        pipelineStepRunId: llmStepRunId,
      });

      let finalStatus: "done" | "aborted" | "error" = "done";
      for await (const evt of runChatGeneration({
        ownerId,
        generationId,
        chatId: msg.chatId,
        branchId,
        entityProfileId: chat.entityProfileId,
        systemPrompt,
        // runChatGeneration currently requires a userMessageId, but regenerate doesn't have one.
        // It is not used inside the orchestrator (v1), so we pass an empty string.
        userMessageId: "",
        assistantMessageId: msg.id,
        variantId: variant.id,
        settings: body.settings,
      })) {
        if (evt.type === "llm.stream.done") {
          finalStatus = evt.data.status;
        }
        sse.send(evt.type, evt.data);
      }

      if (llmStepRunId) {
        await finishPipelineStepRun({
          id: llmStepRunId,
          status: finalStatus === "error" ? "error" : "done",
          output: { status: finalStatus, generationId },
          error: finalStatus === "error" ? "generation_failed" : null,
        });
      }
      if (pipelineRunId) {
        await finishPipelineRun({
          id: pipelineRunId,
          status: finalStatus === "done" ? "done" : finalStatus === "aborted" ? "aborted" : "error",
          meta: { branchId, generationId, status: finalStatus, mode: "regenerate" },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sse.send("llm.stream.error", { message });
      try {
        if (llmStepRunId) {
          await finishPipelineStepRun({
            id: llmStepRunId,
            status: "error",
            output: { status: "error", generationId },
            error: message,
          });
        }
        if (pipelineRunId) {
          await finishPipelineRun({
            id: pipelineRunId,
            status: "error",
            meta: { branchId, generationId, status: "error", error: message, mode: "regenerate" },
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

