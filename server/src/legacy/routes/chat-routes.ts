import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

import { chatService } from "../../services/agent-cards.service";
import { type Chat } from "../../types";

const router = express.Router();

const chatIdParamsSchema = z.object({
  chatId: z.string().min(1),
});

router.get(
  "/chats",
  asyncHandler(async () => {
    const chats = await chatService.service.getChatList();
    return { data: chats };
  })
);

router.get(
  "/chats/:chatId",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const chatId = req.params.chatId as unknown as string;
    const chat = await chatService.service.getChat(chatId);
    return { data: chat };
  })
);

router.post(
  "/chats",
  asyncHandler(async (req: Request) => {
    const newChat = await chatService.service.createChat(req.body as Chat);
    return { data: newChat };
  })
);

router.post(
  "/chats/:chatId/duplicate",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const chatId = req.params.chatId as unknown as string;
    const duplicatedChat = await chatService.service.duplicateChat(chatId);
    return { data: duplicatedChat };
  })
);

router.put(
  "/chats/:chatId",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const updatedChat = await chatService.service.updateChat(req.body as Chat);
    return { data: updatedChat };
  })
);

router.delete(
  "/chats/:chatId",
  validate({ params: chatIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const chatId = req.params.chatId as unknown as string;
    const deletedChat = await chatService.service.deleteChat(chatId);
    return { data: deletedChat };
  })
);

export default router;
