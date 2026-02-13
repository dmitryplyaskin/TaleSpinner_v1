import { renderLiquidTemplate } from "./prompt-template-renderer";

import type {
  InstructionMeta,
  StAdvancedConfig,
  StAdvancedResponseConfig,
  StPrompt,
  StPromptOrder,
  TsInstructionMetaV1,
} from "@shared/types/instructions";
import type { InstructionRenderContext } from "./prompt-template-renderer";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const PROMPT_ORDER_PREFERRED_CHARACTER_ID = 100001;

const ST_PRESET_DETECT_KEYS = new Set([
  "chat_completion_source",
  "prompts",
  "prompt_order",
  "openai_max_tokens",
  "openai_model",
  "temperature",
]);

export const ST_SENSITIVE_FIELDS = [
  "reverse_proxy",
  "proxy_password",
  "custom_url",
  "custom_include_body",
  "custom_exclude_body",
  "custom_include_headers",
  "vertexai_region",
  "vertexai_express_project_id",
  "azure_base_url",
  "azure_deployment_name",
] as const;

const ST_SUPPORTED_PROMPT_IDENTIFIERS = new Set([
  "main",
  "nsfw",
  "jailbreak",
  "worldInfoBefore",
  "worldInfoAfter",
  "charDescription",
  "charPersonality",
  "scenario",
  "personaDescription",
  "chatHistory",
  "dialogueExamples",
]);

type SensitiveImportMode = "remove" | "keep";

type ResolvedAdvancedInstruction = {
  systemPrompt: string;
  preHistorySystemMessages: string[];
  postHistorySystemMessages: string[];
  derivedSettings: Record<string, unknown>;
  usedPromptIdentifiers: string[];
};

type StResponseNumericKey =
  | "temperature"
  | "top_p"
  | "top_k"
  | "top_a"
  | "min_p"
  | "repetition_penalty"
  | "frequency_penalty"
  | "presence_penalty"
  | "openai_max_tokens"
  | "seed"
  | "n";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeStPromptRole(
  value: unknown
): StPrompt["role"] | undefined {
  if (value === "system" || value === "user" || value === "assistant") {
    return value;
  }
  return undefined;
}

function normalizePrompt(prompt: unknown): StPrompt | null {
  if (!isRecord(prompt)) return null;
  const identifier = asString(prompt.identifier);
  if (!identifier) return null;

  const item: StPrompt = { identifier };
  const name = asString(prompt.name);
  if (name) item.name = name;

  const role = normalizeStPromptRole(prompt.role);
  if (role) item.role = role;

  if (typeof prompt.content === "string") item.content = prompt.content;
  if (typeof prompt.system_prompt === "boolean") {
    item.system_prompt = prompt.system_prompt;
  }
  return item;
}

function normalizePromptOrderEntry(
  value: unknown
): { identifier: string; enabled: boolean } | null {
  if (!isRecord(value)) return null;
  const identifier = asString(value.identifier);
  if (!identifier) return null;
  return {
    identifier,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
  };
}

function normalizePromptOrderItem(value: unknown): StPromptOrder | null {
  if (!isRecord(value)) return null;
  const rawCharacterId = value.character_id;
  const characterId =
    typeof rawCharacterId === "number" && Number.isFinite(rawCharacterId)
      ? Math.floor(rawCharacterId)
      : null;
  if (characterId === null) return null;

  const rawOrder = Array.isArray(value.order) ? value.order : [];
  const order = rawOrder
    .map(normalizePromptOrderEntry)
    .filter((entry): entry is { identifier: string; enabled: boolean } =>
      Boolean(entry)
    );
  return {
    character_id: characterId,
    order,
  };
}

export function detectStChatCompletionPreset(
  input: unknown
): input is Record<string, unknown> {
  if (!isRecord(input)) return false;
  if (input.type === "talespinner.instruction") return false;
  return Object.keys(input).some((key) => ST_PRESET_DETECT_KEYS.has(key));
}

export function stripSensitiveFieldsFromPreset(
  preset: Record<string, unknown>
): Record<string, unknown> {
  const cloned = structuredClone(preset);
  for (const key of ST_SENSITIVE_FIELDS) {
    delete cloned[key];
  }
  return cloned;
}

export function normalizeStPrompts(input: unknown): StPrompt[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizePrompt).filter((item): item is StPrompt => Boolean(item));
}

export function normalizeStPromptOrder(input: unknown): StPromptOrder[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(normalizePromptOrderItem)
    .filter((item): item is StPromptOrder => Boolean(item));
}

function normalizeResponseConfig(
  preset: Record<string, unknown>
): StAdvancedResponseConfig {
  const responseConfig: StAdvancedResponseConfig = {};

  const numericKeys: StResponseNumericKey[] = [
    "temperature",
    "top_p",
    "top_k",
    "top_a",
    "min_p",
    "repetition_penalty",
    "frequency_penalty",
    "presence_penalty",
    "openai_max_tokens",
    "seed",
    "n",
  ];

  for (const key of numericKeys) {
    const value = toFiniteNumber(preset[key]);
    if (typeof value === "number") {
      responseConfig[key] = value;
    }
  }

  if (typeof preset.reasoning_effort === "string") {
    responseConfig.reasoning_effort = preset.reasoning_effort;
  }
  if (typeof preset.verbosity === "string") {
    responseConfig.verbosity = preset.verbosity;
  }
  const enableWebSearch = toOptionalBoolean(preset.enable_web_search);
  if (typeof enableWebSearch === "boolean") {
    responseConfig.enable_web_search = enableWebSearch;
  }
  const stream = toOptionalBoolean(preset.stream_openai);
  if (typeof stream === "boolean") {
    responseConfig.stream_openai = stream;
  }

  return responseConfig;
}

function resolvePreferredPromptOrderEntries(
  promptOrder: StPromptOrder[]
): Array<{ identifier: string; enabled: boolean }> {
  if (promptOrder.length === 0) return [];
  const preferred =
    promptOrder.find(
      (item) => item.character_id === PROMPT_ORDER_PREFERRED_CHARACTER_ID
    ) ?? promptOrder[0];
  return preferred.order;
}

function resolveDynamicPromptContent(params: {
  identifier: string;
  context: InstructionRenderContext;
}): string {
  const context = params.context;
  const firstMessageExample =
    typeof context.mesExamples === "string"
      ? context.mesExamples
      : typeof context.mesExamplesRaw === "string"
        ? context.mesExamplesRaw
        : "";

  switch (params.identifier) {
    case "worldInfoBefore":
      return (
        context.wiBefore ??
        context.loreBefore ??
        context.anchorBefore ??
        ""
      );
    case "worldInfoAfter":
      return (
        context.wiAfter ??
        context.loreAfter ??
        context.anchorAfter ??
        ""
      );
    case "charDescription":
      return context.description ?? "";
    case "charPersonality":
      return context.personality ?? "";
    case "scenario":
      return context.scenario ?? "";
    case "personaDescription":
      return context.persona ?? "";
    case "dialogueExamples":
      return firstMessageExample;
    default:
      return "";
  }
}

function toGatewaySettingsFromResponseConfig(
  config: StAdvancedResponseConfig
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};

  if (typeof config.temperature === "number") settings.temperature = config.temperature;
  if (typeof config.top_p === "number") settings.top_p = config.top_p;
  if (typeof config.top_k === "number") settings.top_k = config.top_k;
  if (typeof config.top_a === "number") settings.top_a = config.top_a;
  if (typeof config.min_p === "number") settings.min_p = config.min_p;
  if (typeof config.repetition_penalty === "number") {
    settings.repetition_penalty = config.repetition_penalty;
  }
  if (typeof config.frequency_penalty === "number") {
    settings.frequency_penalty = config.frequency_penalty;
  }
  if (typeof config.presence_penalty === "number") {
    settings.presence_penalty = config.presence_penalty;
  }
  if (typeof config.openai_max_tokens === "number") {
    settings.maxTokens = config.openai_max_tokens;
  }
  if (typeof config.seed === "number") settings.seed = config.seed;
  if (typeof config.n === "number") settings.n = config.n;
  if (typeof config.reasoning_effort === "string") {
    settings.reasoning_effort = config.reasoning_effort;
  }
  if (typeof config.verbosity === "string") settings.verbosity = config.verbosity;
  if (typeof config.enable_web_search === "boolean") {
    settings.enable_web_search = config.enable_web_search;
  }
  if (typeof config.stream_openai === "boolean") {
    settings.stream = config.stream_openai;
  }

  return settings;
}

function normalizeInstructionMeta(meta: unknown): InstructionMeta {
  if (!isRecord(meta)) return {};
  return { ...meta };
}

export function getTsInstructionMeta(meta: unknown): TsInstructionMetaV1 | null {
  if (!isRecord(meta) || !isRecord(meta.tsInstruction)) return null;
  const tsInstruction = meta.tsInstruction;
  if (tsInstruction.version !== 1) return null;
  if (
    tsInstruction.mode !== "basic" &&
    tsInstruction.mode !== "st_advanced"
  ) {
    return null;
  }
  return tsInstruction as TsInstructionMetaV1;
}

export function withTsInstructionMeta(params: {
  meta: unknown;
  tsInstruction: TsInstructionMetaV1;
}): InstructionMeta {
  const normalized = normalizeInstructionMeta(params.meta);
  return {
    ...normalized,
    tsInstruction: params.tsInstruction,
  };
}

export function createStAdvancedConfigFromPreset(params: {
  preset: Record<string, unknown>;
  fileName: string;
  sensitiveImportMode: SensitiveImportMode;
}): StAdvancedConfig {
  const rawPreset =
    params.sensitiveImportMode === "remove"
      ? stripSensitiveFieldsFromPreset(params.preset)
      : structuredClone(params.preset);
  const prompts = normalizeStPrompts(rawPreset.prompts);
  const promptOrder = normalizeStPromptOrder(rawPreset.prompt_order);

  return {
    rawPreset,
    prompts,
    promptOrder,
    responseConfig: normalizeResponseConfig(rawPreset),
    importInfo: {
      source: "sillytavern",
      fileName: params.fileName,
      importedAt: new Date().toISOString(),
    },
  };
}

export async function resolveStAdvancedInstructionRuntime(params: {
  stAdvanced: StAdvancedConfig;
  context: InstructionRenderContext;
}): Promise<ResolvedAdvancedInstruction> {
  const promptsByIdentifier = new Map(
    params.stAdvanced.prompts.map((item) => [item.identifier, item] as const)
  );
  const selectedOrder = resolvePreferredPromptOrderEntries(
    params.stAdvanced.promptOrder
  );
  const fallbackOrder =
    selectedOrder.length > 0
      ? selectedOrder
      : params.stAdvanced.prompts.map((item) => ({
          identifier: item.identifier,
          enabled: true,
        }));

  const preHistory: string[] = [];
  const postHistory: string[] = [];
  const usedPromptIdentifiers: string[] = [];
  let afterHistory = false;

  for (const orderEntry of fallbackOrder) {
    if (!orderEntry.enabled) continue;
    const identifier = orderEntry.identifier;
    if (!ST_SUPPORTED_PROMPT_IDENTIFIERS.has(identifier)) continue;

    if (identifier === "chatHistory") {
      afterHistory = true;
      usedPromptIdentifiers.push(identifier);
      continue;
    }

    const prompt = promptsByIdentifier.get(identifier) ?? null;
    const rawContent =
      typeof prompt?.content === "string" && prompt.content.trim().length > 0
        ? prompt.content
        : resolveDynamicPromptContent({
            identifier,
            context: params.context,
          });
    if (!rawContent.trim()) continue;

    const rendered = await renderLiquidTemplate({
      templateText: rawContent,
      context: params.context,
    });
    if (!rendered.trim()) continue;

    if (afterHistory) postHistory.push(rendered);
    else preHistory.push(rendered);
    usedPromptIdentifiers.push(identifier);
  }

  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let preHistorySystemMessages: string[] = [];
  let postHistorySystemMessages = [...postHistory];

  if (preHistory.length > 0) {
    systemPrompt = preHistory[0];
    preHistorySystemMessages = preHistory.slice(1);
  } else if (postHistory.length > 0) {
    systemPrompt = postHistory[0];
    postHistorySystemMessages = postHistory.slice(1);
  }

  return {
    systemPrompt,
    preHistorySystemMessages,
    postHistorySystemMessages,
    derivedSettings: toGatewaySettingsFromResponseConfig(
      params.stAdvanced.responseConfig
    ),
    usedPromptIdentifiers,
  };
}
