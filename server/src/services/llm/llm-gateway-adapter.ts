import {
  parseProviderConfig,
  openAiCompatibleConfigSchema,
  openRouterConfigSchema,
  type LlmProviderId,
} from "./llm-definitions";

import type {
  LlmGatewayMessage,
  LlmGatewayRequest,
  LlmSamplingParams,
  LlmProviderSpec,
} from "@core/llm-gateway";
import type { GenerateMessage } from "@shared/types/generate";
import type { LlmOpenRouterRoutingConfig } from "@shared/types/llm";

const DEFAULT_OPENROUTER_MODEL =
  "google/gemini-2.0-flash-lite-preview-02-05:free";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";

export type MessageNormalizationGatewayFeature = {
  enabled: boolean;
  mergeSystem?: boolean;
  mergeConsecutiveAssistant?: boolean;
  separator?: string;
};

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function toGatewayMessages(messages: GenerateMessage[]): LlmGatewayMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickFirst<T>(
  settings: Record<string, unknown>,
  keys: string[],
): T | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      return settings[key] as T;
    }
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter(
    (v) => typeof v === "string" && v.trim().length > 0,
  ) as string[];
  return out.length > 0 ? out : null;
}

function resolveGatewayFeatures(params: {
  providerId: LlmProviderId;
  providerConfig: unknown;
}): LlmGatewayRequest["features"] | undefined {
  const parsed = parseProviderConfig(params.providerId, params.providerConfig);
  const messageNormalization = resolveMessageNormalizationFeature({
    providerId: params.providerId,
    providerConfig: params.providerConfig,
  });

  const features: NonNullable<LlmGatewayRequest["features"]> = {
    messageNormalization,
  };

  if (parsed.anthropicCache) {
    features.anthropicCache = parsed.anthropicCache;
  }

  return features;
}

function resolveOpenRouterRoutingExtra(
  config: unknown,
): Record<string, unknown> {
  const parsed = openRouterConfigSchema.parse(config ?? {});
  const routing = parsed.openRouterRouting as
    | LlmOpenRouterRoutingConfig
    | undefined;
  if (!routing) return {};

  const provider: Record<string, unknown> = {};
  if (["price", "throughput", "latency"].includes(routing.strategy)) {
    provider.sort = routing.strategy;
  } else if (routing.strategy === "priority") {
    provider.order = routing.providerOrder;
  } else if (routing.strategy === "only") {
    provider.only = routing.providerOrder;
  }
  if (typeof routing.allowFallbacks === "boolean")
    provider.allow_fallbacks = routing.allowFallbacks;
  if (routing.zdr === true) provider.zdr = true;
  if (routing.dataCollection) provider.data_collection = routing.dataCollection;
  if (routing.requireParameters === true) provider.require_parameters = true;
  return Object.keys(provider).length > 0 ? { provider } : {};
}

export function resolveMessageNormalizationFeature(params: {
  providerId: LlmProviderId;
  providerConfig: unknown;
}): MessageNormalizationGatewayFeature {
  const parsed = parseProviderConfig(params.providerId, params.providerConfig);
  const enabled = parsed.messageNormalization?.enabled !== false;
  if (!enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    mergeSystem: true,
    mergeConsecutiveAssistant: false,
  };
}

export function resolveGatewayModel(params: {
  providerId: LlmProviderId;
  runtimeModel?: string | null;
  providerConfig: unknown;
}): string {
  const runtimeModel = normalizeNonEmptyString(params.runtimeModel);

  if (params.providerId === "openrouter") {
    const parsed = openRouterConfigSchema.parse(params.providerConfig ?? {});
    return (
      runtimeModel ??
      normalizeNonEmptyString(parsed.defaultModel) ??
      DEFAULT_OPENROUTER_MODEL
    );
  }

  const parsed = openAiCompatibleConfigSchema.parse(
    params.providerConfig ?? {},
  );
  return (
    runtimeModel ??
    normalizeNonEmptyString(parsed.defaultModel) ??
    DEFAULT_OPENAI_COMPATIBLE_MODEL
  );
}

export function resolveGatewayProviderSpec(params: {
  providerId: LlmProviderId;
  token: string;
  providerConfig: unknown;
}): LlmProviderSpec {
  if (params.providerId === "openrouter") {
    return { id: "openrouter", token: params.token };
  }

  const parsed = openAiCompatibleConfigSchema.parse(
    params.providerConfig ?? {},
  );
  return {
    id: "openai_compatible",
    token: params.token,
    baseUrl: normalizeBaseUrl(parsed.baseUrl),
  };
}

export function splitSamplingAndExtra(settings: Record<string, unknown>): {
  sampling: LlmSamplingParams;
  extra: Record<string, unknown>;
} {
  const sampling: LlmSamplingParams = {};
  const extra: Record<string, unknown> = {};

  const temperature = pickFirst<unknown>(settings, ["temperature"]);
  if (isFiniteNumber(temperature)) sampling.temperature = temperature;

  const topP = pickFirst<unknown>(settings, ["top_p", "topP"]);
  if (isFiniteNumber(topP)) sampling.top_p = topP;

  const topK = pickFirst<unknown>(settings, ["top_k", "topK"]);
  if (isFiniteNumber(topK)) extra.top_k = topK;

  const minP = pickFirst<unknown>(settings, ["min_p", "minP"]);
  if (isFiniteNumber(minP)) extra.min_p = minP;

  const topA = pickFirst<unknown>(settings, ["top_a", "topA"]);
  if (isFiniteNumber(topA)) extra.top_a = topA;

  const maxTokens = pickFirst<unknown>(settings, ["max_tokens", "maxTokens"]);
  if (isFiniteNumber(maxTokens) && maxTokens > 0)
    sampling.max_tokens = maxTokens;

  const stop = pickFirst<unknown>(settings, ["stop"]);
  const stopSequences = pickFirst<unknown>(settings, ["stopSequences"]);
  if (typeof stop === "string" && stop.trim()) sampling.stop = stop;
  else {
    const arr = asStringArray(stopSequences);
    if (arr) sampling.stop = arr;
  }

  const seed = pickFirst<unknown>(settings, ["seed"]);
  if (isFiniteNumber(seed)) sampling.seed = seed;

  const presencePenalty = pickFirst<unknown>(settings, [
    "presence_penalty",
    "presencePenalty",
  ]);
  if (isFiniteNumber(presencePenalty))
    sampling.presence_penalty = presencePenalty;

  const frequencyPenalty = pickFirst<unknown>(settings, [
    "frequency_penalty",
    "frequencyPenalty",
  ]);
  if (isFiniteNumber(frequencyPenalty))
    sampling.frequency_penalty = frequencyPenalty;

  const repetitionPenalty = pickFirst<unknown>(settings, [
    "repetition_penalty",
    "repetitionPenalty",
  ]);
  if (isFiniteNumber(repetitionPenalty))
    extra.repetition_penalty = repetitionPenalty;

  const rawReasoning = pickFirst<unknown>(settings, ["reasoning"]);
  if (isRecord(rawReasoning)) {
    const reasoning: Record<string, unknown> = {};
    if (typeof rawReasoning.enabled === "boolean")
      reasoning.enabled = rawReasoning.enabled;
    if (
      typeof rawReasoning.effort === "string" &&
      rawReasoning.effort.trim().length > 0
    ) {
      reasoning.effort = rawReasoning.effort;
    }
    if (
      isFiniteNumber(rawReasoning.max_tokens) &&
      rawReasoning.max_tokens > 0
    ) {
      reasoning.max_tokens = rawReasoning.max_tokens;
    }
    if (isFiniteNumber(rawReasoning.maxTokens) && rawReasoning.maxTokens > 0) {
      reasoning.max_tokens = rawReasoning.maxTokens;
    }
    if (typeof rawReasoning.exclude === "boolean")
      reasoning.exclude = rawReasoning.exclude;
    if (Object.keys(reasoning).length > 0) {
      extra.reasoning = reasoning;
    }
  }

  const reasoningEffort = pickFirst<unknown>(settings, [
    "reasoning_effort",
    "reasoningEffort",
  ]);
  if (
    !Object.prototype.hasOwnProperty.call(extra, "reasoning") &&
    typeof reasoningEffort === "string" &&
    reasoningEffort.trim().length > 0
  ) {
    extra.reasoning = { effort: reasoningEffort };
  }

  const blockedKeys = new Set([
    // Reserved request fields
    "model",
    "messages",
    "stream",
    "provider",
    // Sampling keys + common camelCase aliases
    "temperature",
    "top_p",
    "topP",
    "top_k",
    "topK",
    "min_p",
    "minP",
    "top_a",
    "topA",
    "max_tokens",
    "maxTokens",
    "stop",
    "stopSequences",
    "seed",
    "presence_penalty",
    "presencePenalty",
    "frequency_penalty",
    "frequencyPenalty",
    "repetition_penalty",
    "repetitionPenalty",
    "reasoning",
    "reasoning_effort",
    "reasoningEffort",
  ]);

  for (const [key, value] of Object.entries(settings)) {
    if (blockedKeys.has(key)) continue;
    extra[key] = value;
  }

  return { sampling, extra };
}

export function buildGatewayStreamRequest(params: {
  providerId: LlmProviderId;
  token: string;
  providerConfig: unknown;
  runtimeModel?: string | null;
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  abortSignal?: AbortSignal;
}): LlmGatewayRequest {
  const provider = resolveGatewayProviderSpec({
    providerId: params.providerId,
    token: params.token,
    providerConfig: params.providerConfig,
  });

  const model = resolveGatewayModel({
    providerId: params.providerId,
    runtimeModel: params.runtimeModel,
    providerConfig: params.providerConfig,
  });

  const { sampling, extra: settingsExtra } = splitSamplingAndExtra(
    params.settings ?? {},
  );
  const extra = {
    ...settingsExtra,
    ...(params.providerId === "openrouter"
      ? resolveOpenRouterRoutingExtra(params.providerConfig)
      : {}),
  };
  const features = resolveGatewayFeatures({
    providerId: params.providerId,
    providerConfig: params.providerConfig,
  });

  const req: LlmGatewayRequest = {
    provider,
    model,
    messages: toGatewayMessages(params.messages),
    sampling,
    extra,
    abortSignal: params.abortSignal,
  };
  if (features) {
    req.features = features;
  }
  return req;
}
