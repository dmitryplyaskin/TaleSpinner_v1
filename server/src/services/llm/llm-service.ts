import axios from "axios";

import { HttpError } from "@core/middleware/error-handler";

import { llmGateway } from "@core/llm-gateway";
import {
  getProviderConfig,
  getRuntime,
  getTokenPlaintext,
  listProviders,
  listTokens,
  touchTokenLastUsed,
  type LlmRuntimeRow,
  type LlmScope,
} from "./llm-repository";

import type { LlmProviderId } from "./llm-definitions";
import type { GenerateMessage } from "@shared/types/generate";
import {
  buildGatewayStreamRequest,
  resolveGatewayProviderSpec,
} from "./llm-gateway-adapter";

export async function getRuntimeOrThrow(
  scope: LlmScope,
  scopeId: string
): Promise<LlmRuntimeRow> {
  return getRuntime(scope, scopeId);
}

export async function getProvidersForUi(): Promise<
  Array<{ id: LlmProviderId; name: string; enabled: boolean }>
> {
  return listProviders();
}

export async function getTokensForUi(
  providerId: LlmProviderId
): Promise<Array<{ id: string; name: string; tokenHint: string }>> {
  const tokens = await listTokens(providerId);
  return tokens.map((t) => ({
    id: t.id,
    name: t.name,
    tokenHint: t.tokenHint,
  }));
}

export async function getModels(params: {
  providerId: LlmProviderId;
  scope: LlmScope;
  scopeId: string;
  tokenId?: string | null;
  modelOverride?: string | null;
}): Promise<Array<{ id: string; name: string }>> {
  const runtime = await getRuntime(params.scope, params.scopeId);
  const tokenId = params.tokenId ?? runtime.activeTokenId;
  if (!tokenId) {
    return [];
  }

  const token = await getTokenPlaintext(tokenId);
  if (!token) {
    return [];
  }

  const config = await getProviderConfig(params.providerId);
  try {
    if (params.providerId === "openrouter") {
      const response = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: {
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "TaleSpinner",
          Authorization: `Bearer ${token}`,
        },
      });

      const raw = (response.data?.data ?? []) as Array<{ id: string; name?: string }>;
      return raw
        .filter((m) => typeof m?.id === "string" && m.id.length > 0)
        .map((m) => ({ id: m.id, name: m.name ?? m.id }));
    }

    const providerSpec = resolveGatewayProviderSpec({
      providerId: params.providerId,
      token,
      providerConfig: config.config,
    });

    if (!providerSpec.baseUrl) return [];

    const response = await axios.get(`${providerSpec.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const raw = (response.data?.data ?? []) as Array<{ id: string; name?: string }>;
    return raw
      .filter((m) => typeof m?.id === "string" && m.id.length > 0)
      .map((m) => ({ id: m.id, name: m.name ?? m.id }));
  } catch (error) {
    // Models are optional for UX; don't fail hard.
    console.warn("Failed to fetch models", {
      providerId: params.providerId,
      error,
    });
    return [];
  }
}

export async function* streamGlobalChat(params: {
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  scopeId?: string;
  abortController?: AbortController;
}): AsyncGenerator<{ content: string; reasoning: string; error: string | null }> {
  const runtime = await getRuntime("global", params.scopeId ?? "global");
  const providerId = runtime.activeProviderId;
  const tokenId = runtime.activeTokenId;
  if (!tokenId) {
    throw new HttpError(
      400,
      "No active token configured for the selected provider",
      "LLM_TOKEN_MISSING"
    );
  }

  const token = await getTokenPlaintext(tokenId);
  if (!token) {
    throw new HttpError(400, "Active token not found", "LLM_TOKEN_NOT_FOUND");
  }

  const config = await getProviderConfig(providerId);

  await touchTokenLastUsed(tokenId);

  const abortSignal = params.abortController?.signal;
  const req = buildGatewayStreamRequest({
    providerId,
    token,
    providerConfig: config.config,
    runtimeModel: runtime.activeModel,
    messages: params.messages,
    settings: params.settings ?? {},
    abortSignal,
  });

  for await (const evt of llmGateway.stream(req)) {
    if (abortSignal?.aborted) return;
    if (evt.type === "delta") {
      yield { content: evt.text, reasoning: "", error: null };
      continue;
    }
    if (evt.type === "reasoning_delta") {
      yield { content: "", reasoning: evt.text, error: null };
      continue;
    }
    if (evt.type === "error") {
      yield { content: "", reasoning: "", error: evt.message };
      return;
    }
  }
}
