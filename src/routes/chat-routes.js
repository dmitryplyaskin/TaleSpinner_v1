const express = require("express");
const router = express.Router();
const chatService = require("../services/chat-service");

// Получение списка чатов
router.get("/chats", async (req, res) => {
  try {
    const chats = await chatService.getChatList();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/chats/:chatId", async (req, res) => {
  try {
    const chat = await chatService.loadChat(req.params.chatId);
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/chats", async (req, res) => {
  try {
    const newChat = await chatService.createChat(req.body);
    res.json(newChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/chats/:chatId/duplicate", async (req, res) => {
  try {
    const duplicatedChat = await chatService.duplicateChat(req.params.chatId);
    res.json(duplicatedChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/chats/:chatId", async (req, res) => {
  try {
    const updatedChat = await chatService.updateChat(req.body);
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/chats/:chatId", async (req, res) => {
  try {
    const deletedChat = await chatService.deleteChat(req.params.chatId);
    res.json(deletedChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
