const express = require("express");
const router = express.Router();
const chatService = require("../services/chat-service");
const openRouterService = require("../services/open-router-service");
const { v4: uuidv4 } = require("uuid");

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

router.post("/chats:chatId", async (req, res) => {
  try {
    const newChat = await chatService.createChat(req.body);
    res.json(newChat);
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

// Создание нового сообщения в чате
router.post("/chat", async (req, res) => {
  try {
    const {
      chat,
      messages,
      settings,
      newChatMessage,
      chatHistoryId,
      chatMessageId,
      messageId,
    } = req.body;

    const currentChat = await chatService.getChat(chat.id);
    const currentChatHistory = currentChat.chatHistories.find(
      (history) => history.id === chatHistoryId
    );

    const currentChatMessage = currentChatHistory.messages.find(
      (message) => message.id === chatMessageId
    );

    const currentMessageContent = currentChatMessage.content.find(
      (content) => content.id === messageId
    );

    // Настраиваем SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log(req.body);
    // Получаем поток ответов от OpenRouter
    const messageStream = openRouterService.streamResponse(messages, settings);

    let botResponse = "";
    for await (const chunk of messageStream) {
      if (chunk.error) {
        res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
        res.end();
        return;
      }

      botResponse += chunk.content;
      res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);

      currentMessageContent.content = botResponse;
      await chatService.updateChat(currentChat);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
