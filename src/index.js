const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Функция для чтения конфигурации OpenRouter
const getOpenRouterConfig = () => {
  const configPath = path.join(
    __dirname,
    "..",
    "public",
    "config",
    "openrouter.json"
  );
  if (!fs.existsSync(configPath)) {
    throw new Error("OpenRouter configuration file not found");
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
};

// Функция для обновления конфигурации OpenRouter
const updateOpenRouterConfig = (config) => {
  const configDir = path.join(__dirname, "..", "public", "config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, "openrouter.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

// Функция для загрузки истории чата
const loadChatHistory = (chatId) => {
  const chatDir = path.join(__dirname, "..", "public", "chats");
  const filePath = path.join(chatDir, `${chatId}.json`);

  if (!fs.existsSync(filePath)) {
    return { messages: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

// Функция для сохранения истории чата
const saveChatHistory = (chatId, chatData) => {
  const chatDir = path.join(__dirname, "..", "public", "chats");
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }
  const filePath = path.join(chatDir, `${chatId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(chatData, null, 2));
};

// API endpoints
app.get("/api/config/openrouter", (req, res) => {
  try {
    const config = getOpenRouterConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Failed to load OpenRouter configuration" });
  }
});

app.post("/api/config/openrouter", (req, res) => {
  try {
    const { apiKey, model } = req.body;
    updateOpenRouterConfig({ apiKey, model });
    res.json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update OpenRouter configuration" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt, chatId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Загружаем историю чата
    const chatHistory = loadChatHistory(chatId);

    // Добавляем сообщение пользователя в историю
    chatHistory.messages.push({
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    // Сохраняем обновленную историю
    saveChatHistory(chatId, chatHistory);

    // Настраиваем SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Инициализируем OpenAI с актуальными настройками
    const config = getOpenRouterConfig();
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Chat Application",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
    });
    console.log("OpenRouter Config:", config);
    console.log("Messages to send:", chatHistory.messages);

    try {
      // Создаем поток ответов от API
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: chatHistory.messages,
        temperature: 0.7,
        stream: true
      });

      let fullResponse = "";

      // Обрабатываем поток ответов
      for await (const chunk of response) {
        console.log("Received chunk:", chunk);
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Добавляем ответ бота в историю
      chatHistory.messages.push({
        role: "bot",
        content: fullResponse,
        timestamp: new Date().toISOString(),
      });

      // Сохраняем обновленную историю с ответом бота
      saveChatHistory(chatId, chatHistory);

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (streamError) {
      console.error("Stream error:", {
        message: streamError.message,
        response: streamError.response?.data,
        stack: streamError.stack
      });
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });

    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      "Internal server error";
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

app.get("/api/chats/:chatId", (req, res) => {
  try {
    const { chatId } = req.params;
    const chatHistory = loadChatHistory(chatId);
    res.json(chatHistory);
  } catch (error) {
    res.status(500).json({ error: "Failed to load chat history" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
