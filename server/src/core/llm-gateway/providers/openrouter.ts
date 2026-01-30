import type {
  LlmGatewayProviderRequest,
  LlmGatewayResult,
  LlmGatewayStreamEvent,
  LlmProviderAdapter,
} from "../types";
import { OpenAiCompatibleProvider } from "./openai-compatible";

export class OpenRouterProvider implements LlmProviderAdapter {
  readonly id = "openrouter";
  private readonly inner: OpenAiCompatibleProvider;

  constructor() {
    this.inner = new OpenAiCompatibleProvider({
      id: "openrouter.inner",
      defaultBaseUrl: "https://openrouter.ai/api/v1",
    });
  }

  async generate(req: LlmGatewayProviderRequest): Promise<LlmGatewayResult> {
    const patched: LlmGatewayProviderRequest = {
      ...req,
      provider: {
        ...req.provider,
        baseUrl: req.provider.baseUrl ?? "https://openrouter.ai/api/v1",
      },
      headers: {
        // OpenRouter recommended headers (non-fatal elsewhere).
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        ...req.headers,
      },
    };
    return this.inner.generate(patched);
  }

  stream(req: LlmGatewayProviderRequest): AsyncGenerator<LlmGatewayStreamEvent> {
    const patched: LlmGatewayProviderRequest = {
      ...req,
      provider: {
        ...req.provider,
        baseUrl: req.provider.baseUrl ?? "https://openrouter.ai/api/v1",
      },
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        ...req.headers,
      },
    };
    return this.inner.stream(patched);
  }
}

