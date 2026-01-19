import express, { type Request } from "express";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  branchIdParamsSchema,
  chatIdParamsSchema,
  createBranchBodySchema,
  createMessageBodySchema,
  listMessagesQuerySchema,
} from "../chat-core/schemas";
import {
  activateBranch,
  createChatBranch,
  createChatMessage,
  getChatById,
  listChatBranches,
  listChatMessages,
  softDeleteChat,
} from "../services/chat-core/chats-repository";

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
  validate({ params: chatIdParamsSchema, body: createMessageBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const branchId = req.body.branchId || chat.activeBranchId;
    if (!branchId) {
      throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
    }

    if (req.body.role === "assistant") {
      throw new HttpError(
        400,
        "role=assistant запрещён в этом endpoint (v1)",
        "VALIDATION_ERROR"
      );
    }

    const message = await createChatMessage({
      ownerId: req.body.ownerId,
      chatId: params.id,
      branchId,
      role: req.body.role,
      promptText: req.body.promptText,
      format: req.body.format,
      blocks: req.body.blocks,
      meta: req.body.meta,
    });

    return { data: message };
  })
);

export default router;

