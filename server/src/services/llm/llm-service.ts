import axios from "axios";

import { llmGateway } from "@core/llm-gateway";
import { HttpError } from "@core/middleware/error-handler";

import {
  openAiCompatibleConfigSchema,
  openRouterConfigSchema,
  type LlmProviderId,
} from "./llm-definitions";
import {
  buildGatewayStreamRequest,
  resolveGatewayProviderSpec,
} from "./llm-gateway-adapter";
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

import type { GenerateMessage } from "@shared/types/generate";

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

type TokenPolicy = {
  randomize: boolean;
  fallbackOnError: boolean;
};

const MODELS_REQUEST_TIMEOUT_MS = 7000;
const MODELS_REQUEST_RETRIES = 1;
const TOKEN_LAST_USED_TOUCH_INTERVAL_MS = 60_000;
const tokenLastTouchedAt = new Map<string, number>();

function resolveTokenPolicy(providerId: LlmProviderId, config: unknown): TokenPolicy {
  if (providerId === "openrouter") {
    const parsed = openRouterConfigSchema.safeParse(config ?? {});
    const policy = parsed.success ? parsed.data.tokenPolicy : undefined;
    return {
      randomize: policy?.randomize === true,
      fallbackOnError: policy?.fallbackOnError === true,
    };
  }

  const parsed = openAiCompatibleConfigSchema.safeParse(config ?? {});
  const policy = parsed.success ? parsed.data.tokenPolicy : undefined;
  return {
    randomize: policy?.randomize === true,
    fallbackOnError: policy?.fallbackOnError === true,
  };
}

function buildTokenAttemptOrder(params: {
  tokenIds: string[];
  activeTokenId: string | null;
  randomize: boolean;
}): string[] {
  const unique = Array.from(new Set(params.tokenIds));
  if (unique.length === 0) return [];

  if (params.randomize && unique.length > 1) {
    const shuffled = [...unique];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const ordered: string[] = [];
  if (params.activeTokenId) {
    ordered.push(params.activeTokenId);
  }
  for (const tokenId of unique) {
    if (ordered.includes(tokenId)) continue;
    ordered.push(tokenId);
  }
  return ordered;
}

async function fetchModelsWithRetry(
  url: string,
  headers: Record<string, string>
): Promise<Array<{ id: string; name?: string }>> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= MODELS_REQUEST_RETRIES) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: MODELS_REQUEST_TIMEOUT_MS,
      });
      return (response.data?.data ?? []) as Array<{ id: string; name?: string }>;
    } catch (error) {
      lastError = error;
      if (attempt === MODELS_REQUEST_RETRIES) {
        throw error;
      }
      attempt += 1;
    }
  }

  throw lastError;
}

async function touchTokenLastUsedThrottled(tokenId: string): Promise<void> {
  const now = Date.now();
  const prev = tokenLastTouchedAt.get(tokenId) ?? 0;
  if (now - prev < TOKEN_LAST_USED_TOUCH_INTERVAL_MS) {
    return;
  }
  await touchTokenLastUsed(tokenId);
  tokenLastTouchedAt.set(tokenId, now);
}

export function __resetTokenTouchThrottleForTests(): void {
  tokenLastTouchedAt.clear();
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
      const raw = await fetchModelsWithRetry("https://openrouter.ai/api/v1/models", {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        Authorization: `Bearer ${token}`,
      });
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

    const raw = await fetchModelsWithRetry(`${providerSpec.baseUrl}/models`, {
      Authorization: `Bearer ${token}`,
    });
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
  const config = await getProviderConfig(providerId);
  const tokenPolicy = resolveTokenPolicy(providerId, config.config);
  const availableTokens = await listTokens(providerId);
  const tokenIds = availableTokens.map((item) => item.id);
  const attemptOrder = buildTokenAttemptOrder({
    tokenIds,
    activeTokenId: runtime.activeTokenId,
    randomize: tokenPolicy.randomize,
  });

  if (attemptOrder.length === 0) {
    throw new HttpError(
      400,
      "No active token configured for the selected provider",
      "LLM_TOKEN_MISSING"
    );
  }

  const abortSignal = params.abortController?.signal;
  let lastError: string | null = null;

  for (let index = 0; index < attemptOrder.length; index += 1) {
    if (abortSignal?.aborted) return;

    const tokenId = attemptOrder[index];
    const token = await getTokenPlaintext(tokenId);
    if (!token) {
      lastError =
        runtime.activeTokenId === tokenId
          ? "Active token not found"
          : `Token not found: ${tokenId}`;
      continue;
    }

    await touchTokenLastUsedThrottled(tokenId);

    const req = buildGatewayStreamRequest({
      providerId,
      token,
      providerConfig: config.config,
      runtimeModel: runtime.activeModel,
      messages: params.messages,
      settings: params.settings ?? {},
      abortSignal,
    });

    let gotAnyContent = false;
    let attemptError: string | null = null;

    try {
      for await (const evt of llmGateway.stream(req)) {
        if (abortSignal?.aborted) return;

        if (evt.type === "delta") {
          gotAnyContent = true;
          yield { content: evt.text, reasoning: "", error: null };
          continue;
        }
        if (evt.type === "reasoning_delta") {
          gotAnyContent = true;
          yield { content: "", reasoning: evt.text, error: null };
          continue;
        }
        if (evt.type === "error") {
          attemptError = evt.message;
          break;
        }
        if (evt.type === "done") {
          if (evt.status === "aborted") {
            return;
          }
          if (evt.status === "error") {
            attemptError = evt.warnings?.[0] ?? "Provider stream failed";
          }
          break;
        }
      }
    } catch (error) {
      attemptError = error instanceof Error ? error.message : String(error);
    }

    if (!attemptError) {
      return;
    }

    lastError = attemptError;

    const hasNextToken = index < attemptOrder.length - 1;
    const canFallback =
      tokenPolicy.fallbackOnError &&
      hasNextToken &&
      !gotAnyContent &&
      !(abortSignal?.aborted ?? false);

    if (canFallback) {
      continue;
    }

    yield { content: "", reasoning: "", error: attemptError };
    return;
  }

  if (lastError) {
    throw new HttpError(400, lastError, "LLM_TOKEN_NOT_FOUND");
  }

  throw new HttpError(
    400,
    "No active token configured for the selected provider",
    "LLM_TOKEN_MISSING"
  );
}
