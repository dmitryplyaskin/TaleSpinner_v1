import express, { Request, Response } from "express";
import chatService from "../services/agent-cards.service";
import { Chat } from "../types";

const router = express.Router();

router.get("/chats", async (_req: Request, res: Response) => {
  try {
    const chats = await chatService.getChatList();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const chat = await chatService.getChat(req.params.chatId);
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/chats", async (req: Request, res: Response) => {
  try {
    const newChat = await chatService.createChat(req.body as Chat);
    res.json(newChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/chats/:chatId/duplicate", async (req: Request, res: Response) => {
  try {
    const duplicatedChat = await chatService.duplicateChat(req.params.chatId);
    res.json(duplicatedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const updatedChat = await chatService.updateChat(req.body as Chat);
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete("/chats/:chatId", async (req: Request, res: Response) => {
  try {
    const deletedChat = await chatService.deleteChat(req.params.chatId);
    res.json(deletedChat);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
