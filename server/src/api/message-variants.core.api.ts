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
  updateGenerationPromptData,
} from "../services/chat-core/generations-repository";
import {
  createVariantForRegenerate,
  createManualEditVariant,
  listMessageVariants,
  selectMessageVariant,
} from "../services/chat-core/message-variants-repository";
import { getRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";
import { buildPromptDraft } from "../services/chat-core/prompt-draft-builder";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";

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
      const variant = await createVariantForRegenerate({
        ownerId,
        messageId: msg.id,
      });

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
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
        activeProfileSpec: null,
      });

      const runtime = await getRuntimeInfo({ ownerId });

      const createdGen = await createGeneration({
        ownerId,
        chatId: msg.chatId,
        branchId,
        messageId: msg.id,
        variantId: variant.id,
        providerId: runtime.providerId,
        model: runtime.model,
        settings: body.settings,
      });
      generationId = createdGen.id;

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

      const env = {
        chatId: msg.chatId,
        branchId,
        userMessageId: null as null,
        assistantMessageId: msg.id,
        assistantVariantId: variant.id,
        variantId: variant.id,
        generationId,
      };

      sse.send("llm.stream.meta", env);

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
        if (evt.type === "llm.stream.delta") {
          sse.send("llm.stream.delta", { ...env, ...evt.data });
          continue;
        }
        if (evt.type === "llm.stream.error") {
          sse.send("llm.stream.error", { ...env, code: "generation_error", ...evt.data });
          continue;
        }
        sse.send("llm.stream.done", { ...env, ...evt.data });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sse.send("llm.stream.error", {
        chatId: msg.chatId,
        branchId,
        generationId,
        code: "generation_error",
        message,
      });
    } finally {
      sse.close();
    }

    return;
  })
);

export default router;

