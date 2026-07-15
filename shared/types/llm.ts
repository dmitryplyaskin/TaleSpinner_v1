export type LlmProviderId = "openrouter" | "openai_compatible";

export type LlmScope = "global" | "agent";

export type LlmAnthropicCacheTtl = "5m" | "1h";

export type LlmTokenPolicy = {
  randomize?: boolean;
  fallbackOnError?: boolean;
};

export type LlmAnthropicCacheConfig = {
  enabled?: boolean;
  depth?: number;
  ttl?: LlmAnthropicCacheTtl;
};

export type LlmMessageNormalizationConfig = {
  enabled?: boolean;
};

export type LlmOpenRouterRoutingStrategy =
  | "auto"
  | "price"
  | "throughput"
  | "latency"
  | "priority"
  | "only";

export type LlmOpenRouterRoutingConfig = {
  strategy: LlmOpenRouterRoutingStrategy;
  providerOrder?: string[];
  allowFallbacks?: boolean;
  zdr?: boolean;
  dataCollection?: "allow" | "deny";
  requireParameters?: boolean;
};

export type LlmProviderUiField =
  | {
      key: "baseUrl";
      label: string;
      type: "url";
      placeholder?: string;
      required: boolean;
    }
  | {
      key: "defaultModel";
      label: string;
      type: "text";
      placeholder?: string;
      required: boolean;
    };

export type LlmProviderDefinition = {
  id: LlmProviderId;
  name: string;
  enabled: boolean;
  requiresToken: boolean;
  supportsModels: boolean;
  configFields: LlmProviderUiField[];
};

export type LlmRuntime = {
  scope: LlmScope;
  scopeId: string;
  activeProviderId: LlmProviderId;
  activeTokenId: string | null;
  activeTokenHint: string | null;
  activeModel: string | null;
};

export type LlmRuntimeProviderState = {
  scope: LlmScope;
  scopeId: string;
  providerId: LlmProviderId;
  lastTokenId: string | null;
  lastModel: string | null;
};

export type LlmTokenListItem = {
  id: string;
  providerId: LlmProviderId;
  name: string;
  tokenHint: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string | null;
};

export type LlmProviderConfig = {
  baseUrl?: string;
  defaultModel?: string;
  tokenPolicy?: LlmTokenPolicy;
  anthropicCache?: LlmAnthropicCacheConfig;
  messageNormalization?: LlmMessageNormalizationConfig;
  openRouterRouting?: LlmOpenRouterRoutingConfig;
  [key: string]: unknown;
};

export type LlmPresetPayload = {
  activeProviderId: LlmProviderId;
  activeModel: string | null;
  activeTokenId: string | null;
  providerConfigsById: Partial<Record<LlmProviderId, LlmProviderConfig>>;
};

export type LlmPreset = {
  presetId: string;
  ownerId: string;
  name: string;
  description?: string;
  builtIn: boolean;
  version: number;
  payload: LlmPresetPayload;
  createdAt: Date;
  updatedAt: Date;
};

export type LlmPresetSettings = {
  ownerId: string;
  activePresetId: string | null;
  updatedAt: Date;
};

export type LlmModel = {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  inputModalities?: string[];
  outputModalities?: string[];
  supportedParameters?: string[];
  createdAt?: number;
};

export type LlmOpenRouterEndpoint = {
  name: string;
  providerName: string;
  tag: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  quantization?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supportedParameters?: string[];
  uptimeLast30m?: number;
};

export type LlmProviderConnectionIssueCode =
  | "TOKEN_MISSING"
  | "TOKEN_NOT_FOUND"
  | "TOKEN_DECRYPT_FAILED"
  | "CONFIG_INVALID"
  | "BASE_URL_MISSING"
  | "AUTH_ERROR"
  | "ENDPOINT_NOT_FOUND"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | null;

export type LlmProviderConnectionCheckResult = {
  ok: boolean;
  providerId: LlmProviderId;
  issueCode: LlmProviderConnectionIssueCode;
  message: string;
  hints: string[];
  checkedUrl: string | null;
  resolvedBaseUrl: string | null;
  statusCode: number | null;
  modelCount: number;
};
