import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";
import { validateLiquidTemplate } from "../chat-core/prompt-template-renderer";
import { compileLlmJsonSchemaSpec } from "./llm-json-schema-spec";
import { llmOperationParamsSchema } from "./llm-operation-params";

import type {
  ArtifactPersistence,
  ArtifactUsage,
  OperationExecutionMode,
  OperationHook,
  OperationInProfile,
  OperationKind,
  OperationProfileExport,
  OperationProfileUpsertInput,
  OperationTrigger,
  PromptTimeMessageRole,
} from "@shared/types/operation-profiles";

const uuidSchema = z.string().uuid();

const operationHookSchema = z.enum(["before_main_llm", "after_main_llm"] satisfies OperationHook[]);
const operationTriggerSchema = z.enum(["generate", "regenerate"] satisfies OperationTrigger[]);
const executionModeSchema = z.enum(["concurrent", "sequential"] satisfies OperationExecutionMode[]);

const artifactPersistenceSchema = z.enum(["persisted", "run_only"] satisfies ArtifactPersistence[]);
const artifactUsageSchema = z.enum(["prompt_only", "ui_only", "prompt+ui", "internal"] satisfies ArtifactUsage[]);

const artifactTagSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "tag must match ^[a-z][a-z0-9_]*$");

function normalizePromptTimeRole(value: "system" | "developer" | "user" | "assistant"): PromptTimeMessageRole {
  return value === "developer" ? "system" : value;
}

function normalizeDepthFromEnd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(Math.floor(value));
}

const promptTimeRoleSchema = z
  .enum(["system", "developer", "user", "assistant"])
  .transform((value): PromptTimeMessageRole => normalizePromptTimeRole(value));

const artifactWriteTargetSchema = z.object({
  tag: artifactTagSchema,
  persistence: artifactPersistenceSchema,
  usage: artifactUsageSchema,
  semantics: z.string().min(1),
});

const promptTimeEffectSchema = z.discriminatedUnion("kind", [
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
    depthFromEnd: z.number().finite().transform((value) => normalizeDepthFromEnd(value)),
    role: promptTimeRoleSchema,
    source: z.string().trim().min(1).optional(),
  }),
]);

const turnCanonicalizationEffectSchema = z.object({
  kind: z.literal("replace_text"),
  target: z.enum(["user", "assistant"]),
});

const operationOutputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("artifacts"),
    writeArtifact: artifactWriteTargetSchema,
  }),
  z.object({
    type: z.literal("prompt_time"),
    promptTime: promptTimeEffectSchema,
  }),
  z.object({
    type: z.literal("turn_canonicalization"),
    canonicalization: turnCanonicalizationEffectSchema,
  }),
]);

const templateParamsNewSchema = z.object({
  template: z.string(),
  strictVariables: z.boolean().optional(),
  output: operationOutputSchema,
});

const templateParamsLegacySchema = z.object({
  template: z.string(),
  strictVariables: z.boolean().optional(),
  writeArtifact: artifactWriteTargetSchema,
});

const templateParamsSchema = z.union([templateParamsNewSchema, templateParamsLegacySchema]).transform((v) => {
  if ("output" in v) return v;
  return {
    template: v.template,
    strictVariables: v.strictVariables,
    output: {
      type: "artifacts" as const,
      writeArtifact: v.writeArtifact,
    },
  };
});

const otherKindParamsSchema = z.object({
  params: z.record(z.string(), z.unknown()),
  output: operationOutputSchema,
});

const operationConfigTemplateSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  hooks: z.array(operationHookSchema).min(1),
  triggers: z.array(operationTriggerSchema).min(1).optional(),
  order: z.number().finite(),
  dependsOn: z.array(uuidSchema).optional(),
  params: templateParamsSchema,
});

const operationConfigOtherSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  hooks: z.array(operationHookSchema).min(1),
  triggers: z.array(operationTriggerSchema).min(1).optional(),
  order: z.number().finite(),
  dependsOn: z.array(uuidSchema).optional(),
  params: otherKindParamsSchema,
});

const operationConfigLlmSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  hooks: z.array(operationHookSchema).min(1),
  triggers: z.array(operationTriggerSchema).min(1).optional(),
  order: z.number().finite(),
  dependsOn: z.array(uuidSchema).optional(),
  params: z.object({
    params: llmOperationParamsSchema,
    output: operationOutputSchema,
  }),
});

const operationInProfileSchema: z.ZodType<OperationInProfile> = z.discriminatedUnion("kind", [
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
    kind: z.enum([
      "rag",
      "tool",
      "compute",
      "transform",
      "legacy",
    ] satisfies Exclude<OperationKind, "template" | "llm">[]),
    config: operationConfigOtherSchema,
  }),
]);

const upsertInputSchema: z.ZodType<OperationProfileUpsertInput> = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  enabled: z.boolean(),
  executionMode: executionModeSchema,
  operationProfileSessionId: uuidSchema,
  operations: z.array(operationInProfileSchema),
  meta: z.unknown().optional(),
});

export type ValidatedOperationProfileInput = OperationProfileUpsertInput & {
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

function validateCrossRules(input: ValidatedOperationProfileInput): void {
  const opsById = new Map<string, OperationInProfile>();
  const opIds = new Set<string>();
  for (const op of input.operations) {
    if (opIds.has(op.opId)) {
      throw new HttpError(400, "Duplicate opId in profile", "VALIDATION_ERROR", {
        opId: op.opId,
      });
    }
    opIds.add(op.opId);
    opsById.set(op.opId, op);
  }

  for (const op of input.operations) {
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

    const params: any = op.config.params as any;
    const output = params?.output;
    if (output?.type === "prompt_time" && !op.config.hooks.includes("before_main_llm")) {
      throw new HttpError(
        400,
        "prompt_time output requires before_main_llm hook",
        "VALIDATION_ERROR",
        { opId: op.opId }
      );
    }

    if (
      output?.type === "turn_canonicalization" &&
      output?.canonicalization?.target === "assistant" &&
      !op.config.hooks.includes("after_main_llm")
    ) {
      throw new HttpError(
        400,
        "turn_canonicalization target=assistant requires after_main_llm hook",
        "VALIDATION_ERROR",
        { opId: op.opId }
      );
    }

    if (op.kind === "template") {
      try {
        validateLiquidTemplate(op.config.params.template);
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
  }

  if (detectDependencyCycle(input.operations)) {
    throw new HttpError(400, "Dependency cycle detected", "VALIDATION_ERROR");
  }

  const tags = new Map<string, string>(); // tag -> opId
  for (const op of input.operations) {
    const params: any = op.config.params as any;
    if (!params?.output || params.output.type !== "artifacts") continue;
    const tag = params.output.writeArtifact.tag;
    const existing = tags.get(tag);
    if (existing) {
      throw new HttpError(400, "Duplicate artifact tag in profile", "VALIDATION_ERROR", {
        tag,
        opId: op.opId,
        conflictsWithOpId: existing,
      });
    }
    tags.set(tag, op.opId);
  }
}

export function validateOperationProfileUpsertInput(
  raw: unknown
): ValidatedOperationProfileInput {
  const parsed = upsertInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }

  const normalizedOps: OperationInProfile[] = parsed.data.operations.map(
    (op): OperationInProfile => {
      const normalizedConfig = {
        ...op.config,
        hooks: normalizeHooks(op.config.hooks),
        triggers: normalizeTriggers(op.config.triggers),
        dependsOn: normalizeDependsOn(op.config.dependsOn),
      };
      if (op.kind === "template") {
        return { ...op, config: normalizedConfig } as OperationInProfile;
      }
      return { ...op, config: normalizedConfig } as OperationInProfile;
    }
  );

  const validated: ValidatedOperationProfileInput = {
    ...parsed.data,
    operations: normalizedOps,
    meta: typeof parsed.data.meta === "undefined" ? null : parsed.data.meta,
  };

  validateCrossRules(validated);
  return validated;
}

export function validateOperationProfileImport(
  raw: unknown
): ValidatedOperationProfileInput {
  const schema: z.ZodType<OperationProfileExport> = z.object({
    profileId: z.string().uuid().optional(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    executionMode: executionModeSchema,
    operationProfileSessionId: uuidSchema,
    operations: z.array(operationInProfileSchema),
    meta: z.unknown().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }
  return validateOperationProfileUpsertInput({
    name: parsed.data.name,
    description: parsed.data.description,
    enabled: parsed.data.enabled,
    executionMode: parsed.data.executionMode,
    operationProfileSessionId: parsed.data.operationProfileSessionId,
    operations: parsed.data.operations,
    meta: parsed.data.meta,
  });
}

