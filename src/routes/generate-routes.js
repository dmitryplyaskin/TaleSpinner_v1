const express = require("express");
const router = express.Router();
const openRouterService = require("../services/open-router-service");
const { v4: uuidv4 } = require("uuid");

// Создание нового сообщения в чате
router.post("/generate", async (req, res) => {
  try {
    const { messages, settings } = req.body;

    // Настраиваем SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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
