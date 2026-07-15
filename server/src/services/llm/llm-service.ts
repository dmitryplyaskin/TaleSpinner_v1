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
  getTokenPlaintextResult,
  listProviders,
  listTokens,
  touchTokenLastUsed,
  type LlmRuntimeRow,
  type LlmScope,
} from "./llm-repository";
import {
  listOpenRouterModelEndpoints,
  listOpenRouterModels,
} from "./openrouter-catalog";

import type { GenerateMessage } from "@shared/types/generate";
import type {
  LlmModel,
  LlmOpenRouterEndpoint,
  LlmProviderConnectionCheckResult,
} from "@shared/types/llm";

export async function getRuntimeOrThrow(
  scope: LlmScope,
  scopeId: string,
): Promise<LlmRuntimeRow> {
  return getRuntime(scope, scopeId);
}

export async function getProvidersForUi(): Promise<
  Array<{ id: LlmProviderId; name: string; enabled: boolean }>
> {
  return listProviders();
}

export async function getTokensForUi(
  providerId: LlmProviderId,
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

function resolveTokenPolicy(
  providerId: LlmProviderId,
  config: unknown,
): TokenPolicy {
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

function describeTokenLookupFailure(params: {
  tokenId: string;
  activeTokenId: string | null;
  result: Awaited<ReturnType<typeof getTokenPlaintextResult>>;
}): string {
  if (params.result.status === "decrypt_failed") {
    return params.activeTokenId === params.tokenId
      ? "Active token cannot be decrypted with current TOKENS_MASTER_KEY"
      : `Token cannot be decrypted with current TOKENS_MASTER_KEY: ${params.tokenId}`;
  }

  return params.activeTokenId === params.tokenId
    ? "Active token not found"
    : `Token not found: ${params.tokenId}`;
}

async function fetchModelsWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<Array<{ id: string; name?: string }>> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= MODELS_REQUEST_RETRIES) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: MODELS_REQUEST_TIMEOUT_MS,
      });
      return (response.data?.data ?? []) as Array<{
        id: string;
        name?: string;
      }>;
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

function buildConnectionCheckResult(
  params: LlmProviderConnectionCheckResult,
): LlmProviderConnectionCheckResult {
  return params;
}

function readProviderErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" &&
    Number.isFinite(response.status)
    ? response.status
    : null;
}

function readProviderErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function readProviderErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0
    ? message
    : null;
}

function buildProviderConnectivityFailure(params: {
  providerId: LlmProviderId;
  checkedUrl: string | null;
  resolvedBaseUrl: string | null;
  issueCode: LlmProviderConnectionCheckResult["issueCode"];
  message: string;
  hints?: string[];
  statusCode?: number | null;
}): LlmProviderConnectionCheckResult {
  return buildConnectionCheckResult({
    ok: false,
    providerId: params.providerId,
    issueCode: params.issueCode,
    message: params.message,
    hints: params.hints ?? [],
    checkedUrl: params.checkedUrl,
    resolvedBaseUrl: params.resolvedBaseUrl,
    statusCode: params.statusCode ?? null,
    modelCount: 0,
  });
}

function describeProviderConnectivityError(params: {
  providerId: LlmProviderId;
  checkedUrl: string;
  resolvedBaseUrl: string | null;
  error: unknown;
}): LlmProviderConnectionCheckResult {
  const statusCode = readProviderErrorStatus(params.error);
  const errorCode = readProviderErrorCode(params.error);
  const rawMessage = readProviderErrorMessage(params.error);

  if (statusCode === 401 || statusCode === 403) {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: params.checkedUrl,
      resolvedBaseUrl: params.resolvedBaseUrl,
      issueCode: "AUTH_ERROR",
      statusCode,
      message:
        "Provider rejected the selected token while requesting the models endpoint.",
      hints: [
        "Check that the selected token belongs to this provider and is still valid.",
        "If you use a custom OpenAI-compatible backend, verify the backend expects Bearer auth.",
      ],
    });
  }

  if (statusCode === 404) {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: params.checkedUrl,
      resolvedBaseUrl: params.resolvedBaseUrl,
      issueCode: "ENDPOINT_NOT_FOUND",
      statusCode,
      message:
        "Models endpoint was not found. Check Base URL and ensure it points to the API root.",
      hints: [
        "For OpenAI-compatible backends the Base URL usually ends with /v1.",
        "The provider must expose GET /models on that base URL.",
      ],
    });
  }

  if (
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "ECONNABORTED" ||
    errorCode === "ETIMEDOUT"
  ) {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: params.checkedUrl,
      resolvedBaseUrl: params.resolvedBaseUrl,
      issueCode: "NETWORK_ERROR",
      message:
        rawMessage ??
        "Could not reach the provider models endpoint with the current Base URL.",
      hints: [
        "Check Base URL, port, and that the provider server is running.",
        "If you use a custom OpenAI-compatible backend, the Base URL usually ends with /v1.",
      ],
    });
  }

  return buildProviderConnectivityFailure({
    providerId: params.providerId,
    checkedUrl: params.checkedUrl,
    resolvedBaseUrl: params.resolvedBaseUrl,
    issueCode: "PROVIDER_ERROR",
    statusCode,
    message:
      rawMessage ??
      (statusCode
        ? `Provider request failed with HTTP ${statusCode}.`
        : "Provider request failed."),
    hints: statusCode
      ? [`Provider returned HTTP ${statusCode} while requesting /models.`]
      : [],
  });
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
}): Promise<LlmModel[]> {
  const runtime = await getRuntime(params.scope, params.scopeId);
  const tokenId = params.tokenId ?? runtime.activeTokenId;
  if (!tokenId) {
    return [];
  }

  const tokenResult = await getTokenPlaintextResult(tokenId);
  if (tokenResult.status !== "ok") {
    return [];
  }
  const token = tokenResult.plaintext;

  const config = await getProviderConfig(params.providerId);
  try {
    if (params.providerId === "openrouter") {
      return await listOpenRouterModels(token);
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

export async function getOpenRouterModelEndpoints(params: {
  modelId: string;
}): Promise<LlmOpenRouterEndpoint[]> {
  return listOpenRouterModelEndpoints(params.modelId);
}

export async function checkProviderConnection(params: {
  providerId: LlmProviderId;
  scope: LlmScope;
  scopeId: string;
  tokenId?: string | null;
  configOverride?: unknown;
}): Promise<LlmProviderConnectionCheckResult> {
  const runtime = await getRuntime(params.scope, params.scopeId);
  const tokenId = params.tokenId ?? runtime.activeTokenId;

  if (!tokenId) {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: null,
      resolvedBaseUrl: null,
      issueCode: "TOKEN_MISSING",
      message: "Select a token before checking provider connectivity.",
      hints: [
        "Open token manager or choose an existing token in the provider runtime section.",
      ],
    });
  }

  const tokenResult = await getTokenPlaintextResult(tokenId);
  if (tokenResult.status === "decrypt_failed") {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: null,
      resolvedBaseUrl: null,
      issueCode: "TOKEN_DECRYPT_FAILED",
      message:
        "Selected token cannot be decrypted with the current TOKENS_MASTER_KEY.",
      hints: [
        "Re-save the token with the current backend key or restore the original TOKENS_MASTER_KEY.",
      ],
    });
  }

  if (tokenResult.status !== "ok") {
    return buildProviderConnectivityFailure({
      providerId: params.providerId,
      checkedUrl: null,
      resolvedBaseUrl: null,
      issueCode: "TOKEN_NOT_FOUND",
      message: "Selected token was not found.",
      hints: [
        "Pick another token or recreate the missing token in token manager.",
      ],
    });
  }

  const rawConfig =
    typeof params.configOverride === "undefined"
      ? (await getProviderConfig(params.providerId)).config
      : params.configOverride;

  let checkedUrl: string | null = null;
  let resolvedBaseUrl: string | null = null;
  let headers: Record<string, string>;

  if (params.providerId === "openrouter") {
    const parsed = openRouterConfigSchema.safeParse(rawConfig ?? {});
    if (!parsed.success) {
      return buildProviderConnectivityFailure({
        providerId: params.providerId,
        checkedUrl: null,
        resolvedBaseUrl: "https://openrouter.ai/api/v1",
        issueCode: "CONFIG_INVALID",
        message: "OpenRouter provider config is invalid.",
      });
    }
    resolvedBaseUrl = "https://openrouter.ai/api/v1";
    checkedUrl = `${resolvedBaseUrl}/models`;
    headers = {
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "TaleSpinner",
      Authorization: `Bearer ${tokenResult.plaintext}`,
    };
  } else {
    const parsed = openAiCompatibleConfigSchema.safeParse(rawConfig ?? {});
    if (!parsed.success) {
      return buildProviderConnectivityFailure({
        providerId: params.providerId,
        checkedUrl: null,
        resolvedBaseUrl: null,
        issueCode: "BASE_URL_MISSING",
        message: "Base URL is required for the OpenAI-compatible provider.",
        hints: [
          "Use the API root of your provider, for example http://localhost:1234/v1.",
          "Do not paste /chat/completions or another leaf endpoint into Base URL.",
        ],
      });
    }

    const providerSpec = resolveGatewayProviderSpec({
      providerId: params.providerId,
      token: tokenResult.plaintext,
      providerConfig: parsed.data,
    });

    resolvedBaseUrl = providerSpec.baseUrl ?? null;
    if (!resolvedBaseUrl) {
      return buildProviderConnectivityFailure({
        providerId: params.providerId,
        checkedUrl: null,
        resolvedBaseUrl: null,
        issueCode: "BASE_URL_MISSING",
        message: "Base URL is required for the OpenAI-compatible provider.",
        hints: [
          "Use the API root of your provider, for example http://localhost:1234/v1.",
          "Do not paste /chat/completions or another leaf endpoint into Base URL.",
        ],
      });
    }
    checkedUrl = `${resolvedBaseUrl}/models`;
    headers = {
      Authorization: `Bearer ${tokenResult.plaintext}`,
    };
  }

  try {
    const response = await axios.get(checkedUrl, {
      headers,
      timeout: MODELS_REQUEST_TIMEOUT_MS,
    });
    const rawModels = Array.isArray(response.data?.data)
      ? (response.data.data as Array<{ id?: unknown; name?: unknown }>)
      : [];
    const modelCount = rawModels.filter(
      (item) => typeof item?.id === "string" && item.id.length > 0,
    ).length;

    return buildConnectionCheckResult({
      ok: true,
      providerId: params.providerId,
      issueCode: null,
      message:
        modelCount > 0
          ? `Provider connection is working. Models endpoint returned ${modelCount} models.`
          : "Provider connection is working, but the models endpoint returned an empty list.",
      hints:
        modelCount > 0
          ? []
          : [
              "The provider responded successfully, but no models were returned for this token.",
            ],
      checkedUrl,
      resolvedBaseUrl,
      statusCode:
        typeof response.status === "number" && Number.isFinite(response.status)
          ? response.status
          : null,
      modelCount,
    });
  } catch (error) {
    return describeProviderConnectivityError({
      providerId: params.providerId,
      checkedUrl,
      resolvedBaseUrl,
      error,
    });
  }
}

export async function* streamGlobalChat(params: {
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  scopeId?: string;
  abortController?: AbortController;
}): AsyncGenerator<{
  content: string;
  reasoning: string;
  error: string | null;
}> {
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
      "LLM_TOKEN_MISSING",
    );
  }

  const abortSignal = params.abortController?.signal;
  let lastError: string | null = null;

  for (let index = 0; index < attemptOrder.length; index += 1) {
    if (abortSignal?.aborted) return;

    const tokenId = attemptOrder[index];
    const tokenResult = await getTokenPlaintextResult(tokenId);
    if (tokenResult.status !== "ok") {
      lastError = describeTokenLookupFailure({
        tokenId,
        activeTokenId: runtime.activeTokenId,
        result: tokenResult,
      });
      continue;
    }
    const token = tokenResult.plaintext;

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
    "LLM_TOKEN_MISSING",
  );
}
