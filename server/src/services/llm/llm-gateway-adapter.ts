import type { GenerateMessage } from "@shared/types/generate";

import type { LlmGatewayMessage, LlmGatewayRequest, LlmSamplingParams, LlmProviderSpec } from "@core/llm-gateway";

import {
  openAiCompatibleConfigSchema,
  openRouterConfigSchema,
  type LlmProviderId,
} from "./llm-definitions";

const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";

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

function pickFirst<T>(settings: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      return settings[key] as T;
    }
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((v) => typeof v === "string" && v.trim().length > 0) as string[];
  return out.length > 0 ? out : null;
}

export function resolveGatewayModel(params: {
  providerId: LlmProviderId;
  runtimeModel?: string | null;
  providerConfig: unknown;
}): string {
  const runtimeModel = normalizeNonEmptyString(params.runtimeModel);

  if (params.providerId === "openrouter") {
    const parsed = openRouterConfigSchema.parse(params.providerConfig ?? {});
    return runtimeModel ?? normalizeNonEmptyString(parsed.defaultModel) ?? DEFAULT_OPENROUTER_MODEL;
  }

  const parsed = openAiCompatibleConfigSchema.parse(params.providerConfig ?? {});
  return runtimeModel ?? normalizeNonEmptyString(parsed.defaultModel) ?? DEFAULT_OPENAI_COMPATIBLE_MODEL;
}

export function resolveGatewayProviderSpec(params: {
  providerId: LlmProviderId;
  token: string;
  providerConfig: unknown;
}): LlmProviderSpec {
  if (params.providerId === "openrouter") {
    return { id: "openrouter", token: params.token };
  }

  const parsed = openAiCompatibleConfigSchema.parse(params.providerConfig ?? {});
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

  const temperature = pickFirst<unknown>(settings, ["temperature"]);
  if (isFiniteNumber(temperature)) sampling.temperature = temperature;

  const topP = pickFirst<unknown>(settings, ["top_p", "topP"]);
  if (isFiniteNumber(topP)) sampling.top_p = topP;

  const maxTokens = pickFirst<unknown>(settings, ["max_tokens", "maxTokens"]);
  if (isFiniteNumber(maxTokens)) sampling.max_tokens = maxTokens;

  const stop = pickFirst<unknown>(settings, ["stop"]);
  const stopSequences = pickFirst<unknown>(settings, ["stopSequences"]);
  if (typeof stop === "string" && stop.trim()) sampling.stop = stop;
  else {
    const arr = asStringArray(stopSequences);
    if (arr) sampling.stop = arr;
  }

  const seed = pickFirst<unknown>(settings, ["seed"]);
  if (isFiniteNumber(seed)) sampling.seed = seed;

  const presencePenalty = pickFirst<unknown>(settings, ["presence_penalty", "presencePenalty"]);
  if (isFiniteNumber(presencePenalty)) sampling.presence_penalty = presencePenalty;

  const frequencyPenalty = pickFirst<unknown>(settings, ["frequency_penalty", "frequencyPenalty"]);
  if (isFiniteNumber(frequencyPenalty)) sampling.frequency_penalty = frequencyPenalty;

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
    "max_tokens",
    "maxTokens",
    "stop",
    "stopSequences",
    "seed",
    "presence_penalty",
    "presencePenalty",
    "frequency_penalty",
    "frequencyPenalty",
  ]);

  const extra: Record<string, unknown> = {};
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

  const { sampling, extra } = splitSamplingAndExtra(params.settings ?? {});

  return {
    provider,
    model,
    messages: toGatewayMessages(params.messages),
    sampling,
    extra,
    abortSignal: params.abortSignal,
  };
}

