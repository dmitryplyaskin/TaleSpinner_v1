import { z } from "zod";

import type {
  LlmOperationParams,
  LlmOperationRetry,
  LlmOperationRetryOn,
  LlmOperationSamplers,
} from "@shared/types/operation-profiles";

const retryOnSchema = z.enum(["timeout", "provider_error", "rate_limit"] satisfies LlmOperationRetryOn[]);

const samplersSchema: z.ZodType<LlmOperationSamplers> = z
  .object({
    temperature: z.number().finite().optional(),
    topP: z.number().finite().optional(),
    topK: z.number().finite().optional(),
    frequencyPenalty: z.number().finite().optional(),
    presencePenalty: z.number().finite().optional(),
    seed: z.number().finite().optional(),
    maxTokens: z.number().finite().optional(),
  })
  .strict();

const retrySchema: z.ZodType<LlmOperationRetry> = z
  .object({
    maxAttempts: z.number().int().min(1).max(10),
    backoffMs: z.number().int().min(0).max(120_000).optional(),
    retryOn: z.array(retryOnSchema).min(1).optional(),
  })
  .strict();

export const llmOperationParamsSchema: z.ZodType<LlmOperationParams> = z
  .object({
    providerId: z.enum(["openrouter", "openai_compatible"]),
    credentialRef: z.string().trim().min(1),
    model: z.string().trim().min(1).optional(),
    system: z.string().optional(),
    prompt: z.string().min(1),
    strictVariables: z.boolean().optional(),
    outputMode: z.enum(["text", "json"]).optional(),
    samplerPresetId: z.string().trim().min(1).optional(),
    samplers: samplersSchema.optional(),
    timeoutMs: z.number().int().min(1).max(300_000).optional(),
    retry: retrySchema.optional(),
  })
  .strict();

export type NormalizedLlmOperationParams = Omit<
  LlmOperationParams,
  "outputMode" | "strictVariables" | "retry"
> & {
  outputMode: "text" | "json";
  strictVariables: boolean;
  retry?: {
    maxAttempts: number;
    backoffMs: number;
    retryOn: LlmOperationRetryOn[];
  };
};

function normalizeRetry(retry: LlmOperationRetry | undefined): NormalizedLlmOperationParams["retry"] {
  if (!retry) return undefined;
  const retryOn = Array.from(
    new Set<LlmOperationRetryOn>(retry.retryOn ?? ["timeout", "provider_error", "rate_limit"])
  );
  return {
    maxAttempts: retry.maxAttempts,
    backoffMs: retry.backoffMs ?? 0,
    retryOn,
  };
}

export function parseLlmOperationParams(raw: unknown): NormalizedLlmOperationParams {
  const parsed = llmOperationParamsSchema.parse(raw);
  return {
    ...parsed,
    outputMode: parsed.outputMode ?? "text",
    strictVariables: parsed.strictVariables === true,
    retry: normalizeRetry(parsed.retry),
  };
}

