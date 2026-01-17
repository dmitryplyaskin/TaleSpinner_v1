export type LlmProviderId = "openrouter" | "custom_openai";

export type LlmScope = "global" | "agent";

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

export type LlmProviderConfig = Record<string, unknown>;

export type LlmModel = {
  id: string;
  name: string;
};

