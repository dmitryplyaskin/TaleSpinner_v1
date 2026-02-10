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

export type LlmTokenListItem = {
  id: string;
  providerId: LlmProviderId;
  name: string;
  tokenHint: string;
};

export type LlmProviderConfig = {
  baseUrl?: string;
  defaultModel?: string;
  tokenPolicy?: LlmTokenPolicy;
  anthropicCache?: LlmAnthropicCacheConfig;
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
};

