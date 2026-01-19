import express, { type Request, type Response } from "express";
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
import { createGeneration } from "../services/chat-core/generations-repository";
import { getGlobalRuntimeInfo, runChatGeneration } from "../services/chat-core/orchestrator";

const router = express.Router();

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

    const branch = await createChatBranch({
      ownerId: req.body.ownerId,
      chatId: params.id,
      title: req.body.title,
      parentBranchId: req.body.parentBranchId,
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
    try {
      const userMessage = await createChatMessage({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
        role: body.role,
        promptText: body.promptText,
        format: body.format,
        blocks: body.blocks,
        meta: body.meta,
      });

      const assistant = await createAssistantMessageWithVariant({
        ownerId: body.ownerId,
        chatId: params.id,
        branchId,
      });

      const runtime = await getGlobalRuntimeInfo();
      const createdGen = await createGeneration({
        ownerId: body.ownerId,
        chatId: params.id,
        messageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        providerId: runtime.providerId,
        model: runtime.model,
        settings: body.settings,
      });
      generationId = createdGen.id;

      // Close on disconnect and propagate abort.
      req.on("close", () => {
        if (generationId) {
          abortGeneration(generationId);
        }
        sse.close();
      });

      sse.send("llm.stream.meta", {
        chatId: params.id,
        branchId,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        generationId,
      });

      for await (const evt of runChatGeneration({
        generationId,
        chatId: params.id,
        branchId,
        userMessageId: userMessage.id,
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        settings: body.settings,
      })) {
        sse.send(evt.type, evt.data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sse.send("llm.stream.error", { message });
    } finally {
      sse.close();
    }

    return;
  })
);

export default router;

