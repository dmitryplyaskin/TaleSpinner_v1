import fs from "fs";
import path from "path";
import OpenAI from "openai";
import axios from "axios";
import { ChatCompletionMessageParam } from "openai/resources";

interface OpenRouterConfig {
  apiKey: string;
  model?: string;
}

interface OpenRouterResponse {
  content: string;
  error: string | null;
}

class OpenRouterService {
  private configPath: string;

  constructor() {
    this.configPath = path.join(
      __dirname,
      "..",
      "..",
      "data",
      "config",
      "openrouter.json"
    );
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  getConfig(): OpenRouterConfig {
    if (!fs.existsSync(this.configPath)) {
      throw new Error("OpenRouter configuration file not found");
    }
    return JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  updateConfig(config: OpenRouterConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  private createClient(): OpenAI {
    const config = this.getConfig();
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      // @ts-ignore
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
  }

  async getModels(): Promise<any[]> {
    const config = this.getConfig();
    try {
      const response = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: {
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "TaleSpinner",
          Authorization: `Bearer ${config.apiKey}`,
        },
      });
      return response.data.data;
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  }

  async createChatCompletion(
    messages: Array<{ role: string; content: string }>,
    settings: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<any> {
    const client = this.createClient();
    const config = this.getConfig();

    // @ts-ignore
    return await client.chat.completions.create(
      {
        model:
          config?.model || "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: messages as ChatCompletionMessageParam[],
        ...settings,
        include_reasoning: true,
        stream: true,
      },
      { signal }
    );
  }

  async *streamResponse(
    messages: Array<{ role: string; content: string }>,
    settings: Record<string, unknown>,
    abortController?: AbortController
  ): AsyncGenerator<OpenRouterResponse> {
    try {
      const response = await this.createChatCompletion(
        messages,
        settings,
        abortController?.signal
      );

      let fullResponse = "";

      for await (const chunk of response) {
        if (abortController?.signal.aborted) {
          return fullResponse;
        }

        // console.log(chunk.choices[0]?.delta);
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          yield { content, error: null };
        }
      }

      return fullResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "";
      }

      console.error("OpenRouter API Error:", error);
      yield { content: "", error: (error as Error).message };
      return "";
    }
  }
}

export default new OpenRouterService();
