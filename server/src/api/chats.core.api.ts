import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  branchIdParamsSchema,
  chatIdParamsSchema,
  createBranchBodySchema,
  idSchema,
} from "../chat-core/schemas";
import {
  activateBranch,
  createChatBranch,
  getChatById,
  listChatBranches,
  setChatPromptTemplate,
  softDeleteChat,
} from "../services/chat-core/chats-repository";
import { getPromptTemplateById } from "../services/chat-core/prompt-templates-repository";

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

const setPromptTemplateBodySchema = z.object({
  promptTemplateId: idSchema.nullable(),
});

router.put(
  "/chats/:id/prompt-template",
  validate({ params: chatIdParamsSchema, body: setPromptTemplateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = setPromptTemplateBodySchema.parse(req.body);

    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    if (body.promptTemplateId) {
      const tpl = await getPromptTemplateById(body.promptTemplateId);
      if (!tpl || tpl.ownerId !== chat.ownerId) {
        throw new HttpError(404, "PromptTemplate не найден", "NOT_FOUND");
      }
    }

    const updated = await setChatPromptTemplate({
      ownerId: chat.ownerId,
      chatId: chat.id,
      promptTemplateId: body.promptTemplateId,
    });
    if (!updated) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    return { data: updated };
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

export default router;

