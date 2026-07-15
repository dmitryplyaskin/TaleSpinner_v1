import axios from "axios";

import type { LlmModel, LlmOpenRouterEndpoint } from "@shared/types/llm";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 7000;
const REQUEST_RETRIES = 1;

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: unknown;
  architecture?: unknown;
  supported_parameters?: unknown;
  created?: unknown;
};

type RawEndpoint = {
  name?: unknown;
  provider_name?: unknown;
  tag?: unknown;
  context_length?: unknown;
  max_completion_tokens?: unknown;
  quantization?: unknown;
  pricing?: unknown;
  supported_parameters?: unknown;
  uptime_last_30m?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  return items.length > 0 ? items : undefined;
}

function pricing(value: unknown): LlmModel["pricing"] {
  const raw = asRecord(value);
  const prompt = optionalString(raw.prompt);
  const completion = optionalString(raw.completion);
  return prompt || completion ? { prompt, completion } : undefined;
}

function mapModel(raw: RawModel): LlmModel | null {
  const id = optionalString(raw.id);
  if (!id) return null;
  const architecture = asRecord(raw.architecture);
  return {
    id,
    name: optionalString(raw.name) ?? id,
    contextLength: optionalNumber(raw.context_length),
    pricing: pricing(raw.pricing),
    inputModalities: stringArray(architecture.input_modalities),
    outputModalities: stringArray(architecture.output_modalities),
    supportedParameters: stringArray(raw.supported_parameters),
    createdAt: optionalNumber(raw.created),
  };
}

function mapEndpoint(raw: RawEndpoint): LlmOpenRouterEndpoint | null {
  const tag = optionalString(raw.tag);
  if (!tag) return null;
  return {
    name: optionalString(raw.name) ?? tag,
    providerName: optionalString(raw.provider_name) ?? tag,
    tag,
    contextLength: optionalNumber(raw.context_length),
    maxCompletionTokens: optionalNumber(raw.max_completion_tokens),
    quantization: optionalString(raw.quantization),
    pricing: pricing(raw.pricing),
    supportedParameters: stringArray(raw.supported_parameters),
    uptimeLast30m: optionalNumber(raw.uptime_last_30m),
  };
}

async function getWithRetry(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(url, {
        ...(headers ? { headers } : {}),
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function listOpenRouterModels(token: string): Promise<LlmModel[]> {
  const response = asRecord(
    await getWithRetry(`${OPENROUTER_API_URL}/models`, {
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "TaleSpinner",
      Authorization: `Bearer ${token}`,
    }),
  );
  const rows = Array.isArray(response.data)
    ? (response.data as RawModel[])
    : [];
  return rows.map(mapModel).filter((item): item is LlmModel => item !== null);
}

export async function listOpenRouterModelEndpoints(
  modelId: string,
): Promise<LlmOpenRouterEndpoint[]> {
  const encodedModel = modelId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const response = asRecord(
    await getWithRetry(
      `${OPENROUTER_API_URL}/models/${encodedModel}/endpoints`,
    ),
  );
  const data = asRecord(response.data);
  const rows = Array.isArray(data.endpoints)
    ? (data.endpoints as RawEndpoint[])
    : [];
  return rows
    .map(mapEndpoint)
    .filter((item): item is LlmOpenRouterEndpoint => item !== null);
}
