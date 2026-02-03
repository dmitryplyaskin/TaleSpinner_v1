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
  updateGenerationPromptData,
} from "../services/chat-core/generations-repository";
import { getRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";
import { buildPromptDraft } from "../services/chat-core/prompt-draft-builder";
import {
  createMessageTransformVariant,
  createRawUserInputVariant,
} from "../services/chat-core/message-variants-repository";
import { buildPromptTemplateRenderContext } from "../services/chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../services/chat-core/prompt-template-renderer";
import { pickActivePromptTemplate } from "../services/chat-core/prompt-templates-repository";

const router = express.Router();
const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

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

      // Optional v1: message_transform for the *current* user message only.
      // Implemented via variants so prompt assembly still reads selected `promptText`.
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
          meta: { source: "user_message", createdBy: "messageTransform" },
        });

        const transformedVariant = await createMessageTransformVariant({
          ownerId,
          messageId: userMessage.id,
          promptText: transformed,
          meta: {
            source: "message_transform",
            label: body.messageTransform.label ?? null,
            createdBy: "messageTransform",
          },
        });
        void rawVariant;
        void transformedVariant;
      }

      let systemPrompt = DEFAULT_SYSTEM_PROMPT;
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

        if (template) {
          const rendered = await renderLiquidTemplate({
            templateText: template.templateText,
            context,
          });
          const normalized = rendered.trim();
          if (normalized) systemPrompt = normalized;
        }
      } catch {
        // Keep fallback prompt on any template/render failure.
      }

      const builtPrompt = await buildPromptDraft({
        ownerId,
        chatId: params.id,
        branchId,
        systemPrompt,
        historyLimit: 50,
        excludeMessageIds: [assistant.assistantMessageId],
        activeProfileSpec: null,
      });

      const runtime = await getRuntimeInfo({ ownerId });

      const createdGen = await createGeneration({
        ownerId,
        chatId: params.id,
        branchId,
        messageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
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
        chatId: params.id,
        branchId,
        generationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        assistantVariantId: assistant.variantId,
        variantId: assistant.variantId,
      };

      sse.send("llm.stream.meta", env);

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
        chatId: params.id,
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

