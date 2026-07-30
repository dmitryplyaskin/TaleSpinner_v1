import {
  normalizeOperationArtifactConfig,
  type ArtifactExposure,
  type ArtifactFormat,
  type ArtifactPersistence,
  type ArtifactUsage,
  type ArtifactWriteMode,
  type OperationActivationConfig,
  type OperationBlockExport,
  type OperationBlockUpsertInput,
  type OperationHook,
  type OperationInProfile,
  type OperationKind,
  type OperationProfile,
  type OperationRunCondition,
  type OperationTemplateParams,
  type OperationTrigger,
  type PromptTimeMessageRole,
} from "@shared/types/operation-profiles";
import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";

import { validateLiquidTemplate } from "../chat-core/prompt-template-renderer";

import {
  auxLlmGuardParamsSchema,
  guardOperationParamsSchema,
  liquidGuardParamsSchema,
} from "./guard-operation-params";
import { compileGuardOutputSchema } from "./guard-output-contract";
import {
  parseKnowledgeRevealOperationParams,
  parseKnowledgeSearchOperationParams,
} from "./knowledge-operation-params";
import { compileLlmJsonSchemaSpec } from "./llm-json-schema-spec";
import { llmOperationParamsSchema } from "./llm-operation-params";
import { OPERATION_RESOURCE_LIMITS } from "./operation-resource-limits";

import type {
  KnowledgeRevealOperationParams,
  KnowledgeSearchOperationParams,
} from "@shared/types/chat-knowledge";

const uuidSchema = z.string().uuid();

const operationHookSchema = z.enum(["before_main_llm", "after_main_llm"] satisfies OperationHook[]);
const operationTriggerSchema = z.enum(["generate", "regenerate"] satisfies OperationTrigger[]);
const operationActivationSchema = z
  .object({
    everyNTurns: z.number().int().min(1).optional(),
    everyNContextTokens: z.number().int().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (typeof value.everyNTurns === "undefined" && typeof value.everyNContextTokens === "undefined") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "activation must include at least one interval",
      });
    }
  });

const artifactPersistenceSchema = z.enum(["persisted", "run_only"] satisfies ArtifactPersistence[]);
const artifactUsageSchema = z.enum(["prompt_only", "ui_only", "prompt+ui", "internal"] satisfies ArtifactUsage[]);
const artifactWriteModeSchema = z.enum(["replace", "append"] satisfies ArtifactWriteMode[]);
const artifactFormatSchema = z.enum(["text", "markdown", "json"] satisfies ArtifactFormat[]);
const promptTimeRoleSchema = z
  .enum(["system", "developer", "user", "assistant"])
  .transform((value): PromptTimeMessageRole => (value === "developer" ? "system" : value));

const promptPartExposureSchema = z.object({
  type: z.literal("prompt_part"),
  target: z.literal("system"),
  mode: z.enum(["prepend", "append", "replace"]),
  source: z.string().trim().min(1).optional(),
});

const promptMessageExposureSchema = z.union([
  z.object({
    type: z.literal("prompt_message"),
    role: promptTimeRoleSchema,
    anchor: z.literal("after_last_user"),
    source: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal("prompt_message"),
    role: promptTimeRoleSchema,
    anchor: z.literal("depth_from_end"),
    depthFromEnd: z.number().finite().transform((value) => Math.max(0, Math.floor(Math.abs(value)))),
    source: z.string().trim().min(1).optional(),
  }),
]);

const turnRewriteExposureSchema = z.object({
  type: z.literal("turn_rewrite"),
  target: z.enum(["current_user_main", "assistant_output_main"]),
  mode: z.literal("replace"),
});

const uiInlineExposureSchema = z.union([
  z.object({
    type: z.literal("ui_inline"),
    role: promptTimeRoleSchema,
    anchor: z.literal("after_last_user"),
    source: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal("ui_inline"),
    role: promptTimeRoleSchema,
    anchor: z.literal("depth_from_end"),
    depthFromEnd: z.number().finite().transform((value) => Math.max(0, Math.floor(Math.abs(value)))),
    source: z.string().trim().min(1).optional(),
  }),
]);

const artifactExposureSchema: z.ZodType<ArtifactExposure> = z.union([
  promptPartExposureSchema,
  promptMessageExposureSchema,
  turnRewriteExposureSchema,
  uiInlineExposureSchema,
]);

const artifactTagSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "tag must match ^[a-z][a-z0-9_]*$");

const artifactConfigSchema = z.object({
  artifactId: z.string().trim().min(1),
  tag: artifactTagSchema.optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  format: artifactFormatSchema,
  persistence: artifactPersistenceSchema,
  writeMode: artifactWriteModeSchema,
  history: z.object({
    enabled: z.boolean(),
    maxItems: z
      .number()
      .int()
      .min(1)
      .max(OPERATION_RESOURCE_LIMITS.artifactHistoryItems),
  }),
  semantics: z.string().trim().min(1).optional(),
  exposures: z
    .array(artifactExposureSchema)
    .max(OPERATION_RESOURCE_LIMITS.exposuresPerArtifact),
});

const legacyArtifactWriteTargetSchema = z.object({
  tag: artifactTagSchema,
  persistence: artifactPersistenceSchema,
  usage: artifactUsageSchema,
  semantics: z.string().min(1),
});

const legacyPromptTimeEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("append_after_last_user"),
    role: promptTimeRoleSchema,
    source: z.string().trim().min(1).optional(),
  }),
  z.object({
    kind: z.literal("system_update"),
    mode: z.enum(["prepend", "append", "replace"]),
    source: z.string().trim().min(1).optional(),
  }),
  z.object({
    kind: z.literal("insert_at_depth"),
    depthFromEnd: z.number().finite().transform((value) => Math.max(0, Math.floor(Math.abs(value)))),
    role: promptTimeRoleSchema,
    source: z.string().trim().min(1).optional(),
  }),
]);

const legacyOperationOutputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("artifacts"),
    writeArtifact: legacyArtifactWriteTargetSchema,
  }),
  z.object({
    type: z.literal("prompt_time"),
    promptTime: legacyPromptTimeEffectSchema,
  }),
  z.object({
    type: z.literal("turn_canonicalization"),
    canonicalization: z.object({
      kind: z.literal("replace_text"),
      target: z.enum(["user", "assistant"]),
    }),
  }),
]);

const templateParamsSchema = z.object({
  template: z.string().max(OPERATION_RESOURCE_LIMITS.templateCharacters),
  strictVariables: z.boolean().optional(),
  artifact: artifactConfigSchema.optional(),
  output: legacyOperationOutputSchema.optional(),
  writeArtifact: legacyArtifactWriteTargetSchema.optional(),
});

const otherKindParamsSchema = z.object({
  params: z.record(z.string(), z.unknown()),
  artifact: artifactConfigSchema.optional(),
  output: legacyOperationOutputSchema.optional(),
});

const runConditionSchema: z.ZodType<OperationRunCondition> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("guard_output"),
    sourceOpId: uuidSchema,
    outputKey: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z][a-zA-Z0-9_]*$/, "guard output key must match ^[a-z][a-zA-Z0-9_]*$"),
    operator: z.enum(["is_true", "is_false"]),
  }),
]);

const operationConfigBaseSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  hooks: z.array(operationHookSchema).min(1),
  triggers: z.array(operationTriggerSchema).min(1).optional(),
  activation: operationActivationSchema.optional(),
  order: z.number().finite(),
  dependsOn: z
    .array(uuidSchema)
    .max(OPERATION_RESOURCE_LIMITS.dependenciesPerOperation)
    .optional(),
  runConditions: z
    .array(runConditionSchema)
    .max(OPERATION_RESOURCE_LIMITS.runConditionsPerOperation)
    .optional(),
});

const operationConfigTemplateSchema = operationConfigBaseSchema.extend({
  params: templateParamsSchema,
});

const operationConfigOtherSchema = operationConfigBaseSchema.extend({
  params: otherKindParamsSchema,
});

const knowledgeRequestSourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("inline"),
    requestTemplate: z
      .string()
      .min(1)
      .max(OPERATION_RESOURCE_LIMITS.templateCharacters),
    strictVariables: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal("artifact"),
    artifactTag: artifactTagSchema,
  }),
]);

const operationConfigKnowledgeSearchSchema = operationConfigBaseSchema.extend({
  params: z.object({
    params: z.object({
      source: knowledgeRequestSourceSchema,
    }),
    artifact: artifactConfigSchema.optional(),
    output: legacyOperationOutputSchema.optional(),
  }),
});

const operationConfigKnowledgeRevealSchema = operationConfigBaseSchema.extend({
  params: z.object({
    params: z.object({
      source: knowledgeRequestSourceSchema,
    }),
    artifact: artifactConfigSchema.optional(),
    output: legacyOperationOutputSchema.optional(),
  }),
});

const operationConfigLlmSchema = operationConfigBaseSchema.extend({
  params: z.object({
    params: llmOperationParamsSchema,
    artifact: artifactConfigSchema.optional(),
    output: legacyOperationOutputSchema.optional(),
  }),
});

const operationConfigGuardSchema = operationConfigBaseSchema.extend({
  params: z.discriminatedUnion("engine", [
    liquidGuardParamsSchema.extend({
      artifact: artifactConfigSchema.optional(),
    }),
    auxLlmGuardParamsSchema.extend({
      artifact: artifactConfigSchema.optional(),
    }),
  ]),
});

export const operationInProfileSchema: z.ZodType<OperationInProfile> = z
  .discriminatedUnion("kind", [
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.literal("template"),
      config: operationConfigTemplateSchema,
    }),
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.literal("llm"),
      config: operationConfigLlmSchema,
    }),
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.literal("guard"),
      config: operationConfigGuardSchema,
    }),
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.literal("knowledge_search"),
      config: operationConfigKnowledgeSearchSchema,
    }),
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.literal("knowledge_reveal"),
      config: operationConfigKnowledgeRevealSchema,
    }),
    z.object({
      opId: uuidSchema,
      name: z.string().trim().min(1),
      description: z.string().trim().min(1).optional(),
      kind: z.enum([
        "rag",
        "tool",
        "compute",
        "transform",
      ] satisfies Exclude<
        OperationKind,
        "template" | "llm" | "guard" | "knowledge_search" | "knowledge_reveal"
      >[]),
      config: operationConfigOtherSchema,
    }),
  ])
  .transform((op): OperationInProfile => {
    const artifact = normalizeOperationArtifactConfig({
      opId: op.opId,
      kind: op.kind,
      title: op.name,
      rawParams: op.config.params,
    });

    const normalizedConfig = {
      ...op.config,
      params:
        op.kind === "template"
          ? {
              template: op.config.params.template,
              strictVariables: op.config.params.strictVariables,
              artifact,
            }
          : op.kind === "guard"
            ? {
                ...op.config.params,
                artifact,
              }
          : {
              params: op.config.params.params,
              artifact,
            },
    };

    return {
      ...op,
      config: normalizedConfig,
    } as OperationInProfile;
  });

const upsertInputSchema: z.ZodType<OperationBlockUpsertInput> = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  enabled: z.boolean(),
  operations: z
    .array(operationInProfileSchema)
    .max(OPERATION_RESOURCE_LIMITS.operationsPerBlock),
  meta: z.unknown().optional(),
});

export type ValidatedOperationBlockInput = OperationBlockUpsertInput & {
  operations: OperationInProfile[];
  meta: unknown | null;
};

function normalizeTriggers(triggers: OperationTrigger[] | undefined): OperationTrigger[] {
  const raw = triggers?.length ? triggers : (["generate", "regenerate"] as const);
  const set = new Set<OperationTrigger>(raw);
  return (["generate", "regenerate"] as const).filter((t) => set.has(t));
}

function normalizeHooks(hooks: OperationHook[]): OperationHook[] {
  const set = new Set<OperationHook>(hooks);
  return (["before_main_llm", "after_main_llm"] as const).filter((h) => set.has(h));
}

function normalizeDependsOn(dependsOn: string[] | undefined): string[] | undefined {
  if (!dependsOn?.length) return undefined;
  return Array.from(new Set(dependsOn));
}

function normalizeRunConditions(
  runConditions: OperationRunCondition[] | undefined
): OperationRunCondition[] | undefined {
  if (!runConditions?.length) return undefined;
  const seen = new Set<string>();
  const normalized: OperationRunCondition[] = [];
  for (const condition of runConditions) {
    const key = `${condition.type}:${condition.sourceOpId}:${condition.outputKey}:${condition.operator}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(condition);
  }
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeActivation(
  activation: OperationActivationConfig | undefined
): OperationActivationConfig | undefined {
  if (!activation) return undefined;
  const everyNTurns =
    typeof activation.everyNTurns === "number" && Number.isFinite(activation.everyNTurns)
      ? Math.max(1, Math.floor(activation.everyNTurns))
      : undefined;
  const everyNContextTokens =
    typeof activation.everyNContextTokens === "number" &&
    Number.isFinite(activation.everyNContextTokens)
      ? Math.max(1, Math.floor(activation.everyNContextTokens))
      : undefined;
  if (typeof everyNTurns === "undefined" && typeof everyNContextTokens === "undefined") {
    return undefined;
  }
  return { everyNTurns, everyNContextTokens };
}

function detectDependencyCycle(ops: OperationInProfile[]): boolean {
  const depsById = new Map<string, string[]>();
  for (const op of ops) {
    depsById.set(op.opId, op.config.dependsOn ?? []);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visited.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);

    const deps = depsById.get(id) ?? [];
    for (const dep of deps) {
      if (!depsById.has(dep)) continue;
      if (visit(dep)) return true;
    }

    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const op of ops) {
    if (visit(op.opId)) return true;
  }
  return false;
}

function validateExposurePolicy(op: OperationInProfile, exposure: ArtifactExposure): void {
  if (exposure.type === "prompt_part" || exposure.type === "prompt_message") {
    if (!op.config.hooks.includes("before_main_llm")) {
      throw new HttpError(
        400,
        `${exposure.type} requires before_main_llm hook`,
        "VALIDATION_ERROR",
        { opId: op.opId }
      );
    }
    return;
  }

  if (exposure.type === "turn_rewrite" && exposure.target === "assistant_output_main") {
    if (!op.config.hooks.includes("after_main_llm")) {
      throw new HttpError(
        400,
        "turn_rewrite target=assistant_output_main requires after_main_llm hook",
        "VALIDATION_ERROR",
        { opId: op.opId }
      );
    }
    return;
  }

  if (exposure.type === "ui_inline") {
    return;
  }
}

function validateCrossRules(input: ValidatedOperationBlockInput): void {
  const opsById = new Map<string, OperationInProfile>();
  const opIds = new Set<string>();
  for (const op of input.operations) {
    if (opIds.has(op.opId)) {
      throw new HttpError(400, "Duplicate opId in block", "VALIDATION_ERROR", {
        opId: op.opId,
      });
    }
    opIds.add(op.opId);
    opsById.set(op.opId, op);
  }

  const artifactIds = new Map<string, string>();
  const artifactTags = new Map<string, string>();
  for (const op of input.operations) {
    for (const exposure of op.config.params.artifact.exposures) {
      validateExposurePolicy(op, exposure);
    }

    const deps = op.config.dependsOn ?? [];
    for (const dep of deps) {
      if (dep === op.opId) {
        throw new HttpError(400, "Operation dependsOn itself", "VALIDATION_ERROR", {
          opId: op.opId,
        });
      }
      if (!opIds.has(dep)) {
        throw new HttpError(400, "dependsOn references unknown opId", "VALIDATION_ERROR", {
          opId: op.opId,
          dependsOn: dep,
        });
      }

      const depOp = opsById.get(dep);
      if (depOp) {
        const depHooks = new Set(depOp.config.hooks);
        const isSubset = op.config.hooks.every((hook) => depHooks.has(hook));
        if (!isSubset) {
          throw new HttpError(
            400,
            "Cross-hook dependsOn is not allowed: op.hooks must be a subset of dependency hooks",
            "VALIDATION_ERROR",
            {
              opId: op.opId,
              dependsOn: dep,
            }
          );
        }
      }
    }

    for (const condition of op.config.runConditions ?? []) {
      if (condition.type !== "guard_output") continue;
      if (!opIds.has(condition.sourceOpId)) {
        throw new HttpError(400, "runCondition references unknown opId", "VALIDATION_ERROR", {
          opId: op.opId,
          sourceOpId: condition.sourceOpId,
        });
      }
      if (!(op.config.dependsOn ?? []).includes(condition.sourceOpId)) {
        throw new HttpError(
          400,
          "runCondition sourceOpId must also appear in dependsOn",
          "VALIDATION_ERROR",
          {
            opId: op.opId,
            sourceOpId: condition.sourceOpId,
          }
        );
      }

      const sourceOp = opsById.get(condition.sourceOpId);
      if (!sourceOp || sourceOp.kind !== "guard") {
        throw new HttpError(
          400,
          "runCondition sourceOpId must reference guard operation",
          "VALIDATION_ERROR",
          {
            opId: op.opId,
            sourceOpId: condition.sourceOpId,
          }
        );
      }

      const outputKeys = new Set(sourceOp.config.params.outputContract.map((item) => item.key));
      if (!outputKeys.has(condition.outputKey)) {
        throw new HttpError(
          400,
          "runCondition references unknown guard output",
          "VALIDATION_ERROR",
          {
            opId: op.opId,
            sourceOpId: condition.sourceOpId,
            outputKey: condition.outputKey,
          }
        );
      }
    }

    if (op.kind === "template") {
      try {
        validateLiquidTemplate((op.config.params as OperationTemplateParams).template);
      } catch (error) {
        throw new HttpError(
          400,
          `Template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }
    }

    if (op.kind === "llm") {
      const llmParams = llmOperationParamsSchema.parse(op.config.params.params);
      try {
        validateLiquidTemplate(llmParams.prompt);
      } catch (error) {
        throw new HttpError(
          400,
          `LLM prompt template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }
      if (typeof llmParams.system === "string" && llmParams.system.length > 0) {
        try {
          validateLiquidTemplate(llmParams.system);
        } catch (error) {
          throw new HttpError(
            400,
            `LLM system template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
            "VALIDATION_ERROR",
            { opId: op.opId }
          );
        }
      }

      if (llmParams.strictSchemaValidation && llmParams.outputMode !== "json") {
        throw new HttpError(
          400,
          "LLM strictSchemaValidation requires outputMode=json",
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }

      if (llmParams.strictSchemaValidation && typeof llmParams.jsonSchema === "undefined") {
        throw new HttpError(
          400,
          "LLM strictSchemaValidation requires jsonSchema",
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }

      if (typeof llmParams.jsonSchema !== "undefined") {
        try {
          compileLlmJsonSchemaSpec(llmParams.jsonSchema);
        } catch (error) {
          throw new HttpError(
            400,
            `LLM jsonSchema не валидна: ${error instanceof Error ? error.message : String(error)}`,
            "VALIDATION_ERROR",
            { opId: op.opId }
          );
        }
      }
    }

    if (op.kind === "guard") {
      const { artifact: _artifact, ...rawGuardParams } = op.config.params;
      const guardParams = guardOperationParamsSchema.parse(rawGuardParams);
      try {
        compileGuardOutputSchema(guardParams.outputContract);
      } catch (error) {
        throw new HttpError(
          400,
          `Guard output contract is invalid: ${error instanceof Error ? error.message : String(error)}`,
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }

      if (op.config.params.artifact.format !== "json") {
        throw new HttpError(
          400,
          "Guard artifact format must be json",
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }

      if (guardParams.engine === "liquid") {
        try {
          validateLiquidTemplate(guardParams.template);
        } catch (error) {
          throw new HttpError(
            400,
            `Guard template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
            "VALIDATION_ERROR",
            { opId: op.opId }
          );
        }
      }

      if (guardParams.engine === "aux_llm") {
        try {
          validateLiquidTemplate(guardParams.prompt);
        } catch (error) {
          throw new HttpError(
            400,
            `Guard prompt template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
            "VALIDATION_ERROR",
            { opId: op.opId }
          );
        }
        if (typeof guardParams.system === "string" && guardParams.system.length > 0) {
          try {
            validateLiquidTemplate(guardParams.system);
          } catch (error) {
            throw new HttpError(
              400,
              `Guard system template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
              "VALIDATION_ERROR",
              { opId: op.opId }
            );
          }
        }
      }
    }

    if (op.kind === "knowledge_search" || op.kind === "knowledge_reveal") {
      const parser:
        | ((raw: unknown) => KnowledgeSearchOperationParams)
        | ((raw: unknown) => KnowledgeRevealOperationParams) =
        op.kind === "knowledge_search"
          ? parseKnowledgeSearchOperationParams
          : parseKnowledgeRevealOperationParams;
      const knowledgeParams = parser(op.config.params.params);

      if (op.config.params.artifact.format !== "json") {
        throw new HttpError(
          400,
          `${op.kind} artifact format must be json`,
          "VALIDATION_ERROR",
          { opId: op.opId }
        );
      }

      if (knowledgeParams.source.mode === "inline") {
        try {
          validateLiquidTemplate(knowledgeParams.source.requestTemplate);
        } catch (error) {
          throw new HttpError(
            400,
            `${op.kind} template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
            "VALIDATION_ERROR",
            { opId: op.opId }
          );
        }
      }
    }

    const existingArtifactId = artifactIds.get(op.config.params.artifact.artifactId);
    if (existingArtifactId) {
      throw new HttpError(400, "Duplicate artifactId in block", "VALIDATION_ERROR", {
        artifactId: op.config.params.artifact.artifactId,
        opId: op.opId,
        conflictsWithOpId: existingArtifactId,
      });
    }
    artifactIds.set(op.config.params.artifact.artifactId, op.opId);

    const existingTag = artifactTags.get(op.config.params.artifact.tag);
    if (existingTag) {
      throw new HttpError(400, "Duplicate artifact tag in block", "VALIDATION_ERROR", {
        tag: op.config.params.artifact.tag,
        opId: op.opId,
        conflictsWithOpId: existingTag,
      });
    }
    artifactTags.set(op.config.params.artifact.tag, op.opId);
  }

  if (detectDependencyCycle(input.operations)) {
    throw new HttpError(400, "Dependency cycle detected", "VALIDATION_ERROR");
  }
}

export function validateOperationBlockUpsertInput(raw: unknown): ValidatedOperationBlockInput {
  const parsed = upsertInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }

  const normalizedOps: OperationInProfile[] = parsed.data.operations.map((op): OperationInProfile => {
    const normalizedConfig = {
      ...op.config,
      hooks: normalizeHooks(op.config.hooks),
      triggers: normalizeTriggers(op.config.triggers),
      activation: normalizeActivation(op.config.activation),
      dependsOn: normalizeDependsOn(op.config.dependsOn),
      runConditions: normalizeRunConditions(op.config.runConditions),
    };
    return { ...op, config: normalizedConfig } as OperationInProfile;
  });

  const validated: ValidatedOperationBlockInput = {
    ...parsed.data,
    operations: normalizedOps,
    meta: typeof parsed.data.meta === "undefined" ? null : parsed.data.meta,
  };

  validateCrossRules(validated);
  return validated;
}

export function validateOperationBlockImport(raw: unknown): ValidatedOperationBlockInput {
  const schema: z.ZodType<OperationBlockExport> = z.object({
    blockId: z.string().uuid().optional(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    operations: z.array(operationInProfileSchema),
    meta: z.unknown().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }
  return validateOperationBlockUpsertInput({
    name: parsed.data.name,
    description: parsed.data.description,
    enabled: parsed.data.enabled,
    operations: parsed.data.operations,
    meta: parsed.data.meta,
  });
}

export function validateCompiledProfileArtifactWriters(profile: OperationProfile): void {
  const artifactIds = new Map<string, string>();
  const artifactTags = new Map<string, string>();

  for (const op of profile.operations ?? []) {
    const artifactId = op.config.params.artifact.artifactId;
    const existingArtifactId = artifactIds.get(artifactId);
    if (existingArtifactId) {
      throw new HttpError(400, "Duplicate artifactId in compiled profile", "VALIDATION_ERROR", {
        artifactId,
        opId: op.opId,
        conflictsWithOpId: existingArtifactId,
      });
    }
    artifactIds.set(artifactId, op.opId);

    const tag = op.config.params.artifact.tag;
    const existingTag = artifactTags.get(tag);
    if (existingTag) {
      throw new HttpError(400, "Duplicate artifact tag in compiled profile", "VALIDATION_ERROR", {
        tag,
        opId: op.opId,
        conflictsWithOpId: existingTag,
      });
    }
    artifactTags.set(tag, op.opId);
  }
}
