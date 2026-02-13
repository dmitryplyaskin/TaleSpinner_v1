export type RagProviderId = 'openrouter' | 'ollama';

export type RagModel = {
  id: string;
  name: string;
};

export type RagProviderDefinition = {
  id: RagProviderId;
  name: string;
  enabled: boolean;
  requiresToken: boolean;
  supportsModels: boolean;
  configFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'url' | 'number' | 'select';
    required: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
};

export type RagProviderConfig = {
  baseUrl?: string;
  defaultModel?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
  user?: string;
  keepAlive?: string;
  truncate?: boolean;
  [key: string]: unknown;
};

export type RagRuntime = {
  activeProviderId: RagProviderId;
  activeTokenId: string | null;
  activeModel: string | null;
  activeTokenHint: string | null;
};

export type RagPresetPayload = {
  activeProviderId: RagProviderId;
  activeTokenId: string | null;
  activeModel: string | null;
  providerConfigsById: Partial<Record<RagProviderId, RagProviderConfig>>;
};

export type RagPreset = {
  id: string;
  name: string;
  payload: RagPresetPayload;
  createdAt: string;
  updatedAt: string;
};

export type RagPresetSettings = {
  selectedId: string | null;
};
