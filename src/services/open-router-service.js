const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const axios = require("axios");

class OpenRouterService {
  constructor() {
    this.configPath = path.join(
      __dirname,
      "..",
      "..",
      "public",
      "config",
      "openrouter.json"
    );
    this.ensureConfigDirectory();
  }

  ensureConfigDirectory() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  getConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error("OpenRouter configuration file not found");
    }
    return JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  updateConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  createClient() {
    const config = this.getConfig();
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Chat Application",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
  }

  async getModels() {
    const config = this.getConfig();
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: {
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "Chat Application",
          Authorization: `Bearer ${config.apiKey}`,
        },
      });
      return response.data.data;
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  }

  async createChatCompletion(messages, settings = {}) {
    const client = this.createClient();
    const config = this.getConfig();

    console.log("messages", messages);
    console.log("settings", settings);
    // console.log("config", config);

    return await client.chat.completions.create({
      model: config?.model || "amazon/nova-micro-v1",
      messages: messages,
      ...settings,
      stream: true,
    });
  }

  async *streamResponse(messages, settings) {
    try {
      const response = await this.createChatCompletion(messages, settings);
      let fullResponse = "";

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          yield { content, error: null };
        }
      }

      return fullResponse;
    } catch (error) {
      console.error("OpenRouter API Error:", error);
      yield { content: "", error: error.message };
      return "";
    }
  }
}

module.exports = new OpenRouterService();
