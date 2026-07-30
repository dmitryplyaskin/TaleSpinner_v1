import { z } from "zod";

import { OPERATION_RESOURCE_LIMITS } from "./operation-resource-limits";

import type {
  GuardAuxLlmParams,
  GuardLiquidParams,
  GuardOperationParams,
  GuardOutputContract,
  GuardOutputDefinition,
  LlmOperationRetry,
  LlmOperationRetryOn,
  LlmOperationSamplers,
} from "@shared/types/operation-profiles";

const guardOutputKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-zA-Z0-9_]*$/, "guard output key must match ^[a-z][a-zA-Z0-9_]*$");

const guardOutputDefinitionSchema: z.ZodType<GuardOutputDefinition> = z.object({
  key: guardOutputKeySchema,
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
});

export const guardOutputContractSchema: z.ZodType<GuardOutputContract> = z
  .array(guardOutputDefinitionSchema)
  .min(1)
  .max(32)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate guard output key: ${item.key}`,
          path: ["key"],
        });
      }
      seen.add(item.key);
    }
  });

const retryOnSchema = z.enum(["timeout", "provider_error", "rate_limit"] satisfies LlmOperationRetryOn[]);
const reasoningEffortSchema = z.enum(["low", "medium", "high"]);

const samplersSchema: z.ZodType<LlmOperationSamplers> = z
  .object({
    temperature: z.number().finite().optional(),
    topP: z.number().finite().optional(),
    topK: z.number().finite().optional(),
    minP: z.number().finite().optional(),
    topA: z.number().finite().optional(),
    frequencyPenalty: z.number().finite().optional(),
    presencePenalty: z.number().finite().optional(),
    repetitionPenalty: z.number().finite().optional(),
    seed: z.number().finite().optional(),
    maxTokens: z.number().finite().optional(),
    reasoning: z
      .object({
        enabled: z.boolean().optional(),
        effort: reasoningEffortSchema.optional(),
        maxTokens: z.number().finite().optional(),
        exclude: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const retrySchema: z.ZodType<LlmOperationRetry> = z
  .object({
    maxAttempts: z.number().int().min(1).max(3),
    backoffMs: z.number().int().min(0).max(120_000).optional(),
    retryOn: z.array(retryOnSchema).min(1).optional(),
  })
  .strict();

export const liquidGuardParamsSchema = z
  .object({
    engine: z.literal("liquid"),
    outputContract: guardOutputContractSchema,
    template: z.string().max(OPERATION_RESOURCE_LIMITS.templateCharacters),
    strictVariables: z.boolean().optional(),
  })
  .strict();

export const auxLlmGuardParamsSchema = z
  .object({
    engine: z.literal("aux_llm"),
    outputContract: guardOutputContractSchema,
    providerId: z.enum(["openrouter", "openai_compatible"]),
    credentialRef: z.string().trim().min(1),
    model: z.string().trim().min(1).optional(),
    system: z.string().max(OPERATION_RESOURCE_LIMITS.templateCharacters).optional(),
    prompt: z
      .string()
      .min(1)
      .max(OPERATION_RESOURCE_LIMITS.templateCharacters),
    strictVariables: z.boolean().optional(),
    samplers: samplersSchema.optional(),
    timeoutMs: z.number().int().min(1).max(120_000).optional(),
    retry: retrySchema.optional(),
  })
  .strict();

export const guardOperationParamsSchema = z.discriminatedUnion("engine", [
  liquidGuardParamsSchema,
  auxLlmGuardParamsSchema,
]);

export type NormalizedGuardOperationParams =
  | (Omit<GuardLiquidParams, "artifact" | "strictVariables"> & {
      strictVariables: boolean;
    })
  | (Omit<GuardAuxLlmParams, "artifact" | "strictVariables"> & {
      strictVariables: boolean;
    });

export function parseGuardOperationParams(
  raw: unknown
): NormalizedGuardOperationParams {
  const parsed = guardOperationParamsSchema.parse(raw) as Omit<GuardOperationParams, "artifact">;
  if (parsed.engine === "liquid") {
    const liquid = parsed as Omit<GuardLiquidParams, "artifact">;
    return {
      ...liquid,
      strictVariables: liquid.strictVariables === true,
    };
  }

  const aux = parsed as Omit<GuardAuxLlmParams, "artifact">;
  return {
    ...aux,
    strictVariables: aux.strictVariables === true,
  };
}
