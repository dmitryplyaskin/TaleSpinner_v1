import { z } from "zod";

export type LlmProviderId = "openrouter" | "custom_openai";

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
  enabledByDefault: boolean;
  requiresToken: boolean;
  supportsModels: boolean;
  configFields: LlmProviderUiField[];
};

export const llmProviderDefinitions: ReadonlyArray<LlmProviderDefinition> = [
  {
    id: "openrouter",
    name: "OpenRouter",
    enabledByDefault: true,
    requiresToken: true,
    supportsModels: true,
    configFields: [
      {
        key: "defaultModel",
        label: "Default model",
        type: "text",
        placeholder: "google/gemini-2.0-flash-lite-preview-02-05:free",
        required: false,
      },
    ],
  },
  {
    id: "custom_openai",
    name: "Custom OpenAI (OpenAI-compatible)",
    enabledByDefault: true,
    requiresToken: true,
    supportsModels: true,
    configFields: [
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        placeholder: "http://localhost:1234/v1",
        required: true,
      },
      {
        key: "defaultModel",
        label: "Default model",
        type: "text",
        placeholder: "gpt-4o-mini",
        required: false,
      },
    ],
  },
];

export const openRouterConfigSchema = z
  .object({
    defaultModel: z.string().min(1).optional(),
  })
  .passthrough();

export type OpenRouterConfig = z.infer<typeof openRouterConfigSchema>;

export const customOpenAiConfigSchema = z
  .object({
    baseUrl: z.string().min(1),
    defaultModel: z.string().min(1).optional(),
  })
  .passthrough();

export type CustomOpenAiConfig = z.infer<typeof customOpenAiConfigSchema>;

export function parseProviderConfig(
  providerId: LlmProviderId,
  config: unknown
): OpenRouterConfig | CustomOpenAiConfig {
  if (providerId === "openrouter") {
    return openRouterConfigSchema.parse(config ?? {});
  }
  return customOpenAiConfigSchema.parse(config ?? {});
}

