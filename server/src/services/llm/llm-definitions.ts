import { z } from "zod";

import type { LlmOpenRouterRoutingStrategy } from "@shared/types/llm";

export type LlmProviderId = "openrouter" | "openai_compatible";
export type LlmAnthropicCacheTtl = "5m" | "1h";

export const tokenPolicySchema = z
  .object({
    randomize: z.boolean().optional(),
    fallbackOnError: z.boolean().optional(),
  })
  .strict();

export const anthropicCacheSchema = z
  .object({
    enabled: z.boolean().optional(),
    depth: z.number().int().min(0).optional(),
    ttl: z.enum(["5m", "1h"] satisfies LlmAnthropicCacheTtl[]).optional(),
  })
  .strict();

export const messageNormalizationSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .strict();

export const openRouterRoutingSchema = z
  .object({
    strategy: z.enum([
      "auto",
      "price",
      "throughput",
      "latency",
      "priority",
      "only",
    ] satisfies LlmOpenRouterRoutingStrategy[]),
    providerOrder: z.array(z.string().trim().min(1)).max(20).optional(),
    allowFallbacks: z.boolean().optional(),
    zdr: z.boolean().optional(),
    dataCollection: z.enum(["allow", "deny"]).optional(),
    requireParameters: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.strategy === "priority" || value.strategy === "only") &&
      (!value.providerOrder || value.providerOrder.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["providerOrder"],
        message: "Select at least one OpenRouter endpoint provider",
      });
    }
  });

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
    id: "openai_compatible",
    name: "OpenAI-compatible",
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
    tokenPolicy: tokenPolicySchema.optional(),
    anthropicCache: anthropicCacheSchema.optional(),
    messageNormalization: messageNormalizationSchema.optional(),
    openRouterRouting: openRouterRoutingSchema.optional(),
  })
  .passthrough();

export type OpenRouterConfig = z.infer<typeof openRouterConfigSchema>;

export const openAiCompatibleConfigSchema = z
  .object({
    baseUrl: z.string().min(1),
    defaultModel: z.string().min(1).optional(),
    tokenPolicy: tokenPolicySchema.optional(),
    anthropicCache: anthropicCacheSchema.optional(),
    messageNormalization: messageNormalizationSchema.optional(),
  })
  .passthrough();

export type OpenAiCompatibleConfig = z.infer<
  typeof openAiCompatibleConfigSchema
>;

export function parseProviderConfig(
  providerId: LlmProviderId,
  config: unknown,
): OpenRouterConfig | OpenAiCompatibleConfig {
  if (providerId === "openrouter") {
    return openRouterConfigSchema.parse(config ?? {});
  }
  return openAiCompatibleConfigSchema.parse(config ?? {});
}
