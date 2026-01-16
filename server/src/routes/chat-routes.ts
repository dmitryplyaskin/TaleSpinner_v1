import express, { Request, Response } from "express";
import { chatService } from "../services/agent-cards.service";
import { Chat } from "../types";

const router = express.Router();

router.get("/chats", async (_req: Request, res: Response) => {
  try {
    const chats = await chatService.service.getChatList();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const chatIdParam = req.params.chatId;
    const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

    if (!chatId) {
      res.status(400).json({ error: "chatId обязателен" });
      return;
    }

    const chat = await chatService.service.getChat(chatId);
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/chats", async (req: Request, res: Response) => {
  try {
    const newChat = await chatService.service.createChat(req.body as Chat);
    res.json(newChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/chats/:chatId/duplicate", async (req: Request, res: Response) => {
  try {
    const chatIdParam = req.params.chatId;
    const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

    if (!chatId) {
      res.status(400).json({ error: "chatId обязателен" });
      return;
    }

    const duplicatedChat = await chatService.service.duplicateChat(chatId);
    res.json(duplicatedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const updatedChat = await chatService.service.updateChat(req.body as Chat);
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const chatIdParam = req.params.chatId;
    const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

    if (!chatId) {
      res.status(400).json({ error: "chatId обязателен" });
      return;
    }

    const deletedChat = await chatService.service.deleteChat(chatId);
    res.json(deletedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
