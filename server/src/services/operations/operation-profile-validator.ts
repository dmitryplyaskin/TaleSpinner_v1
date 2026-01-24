import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";

import type {
  ArtifactPersistence,
  ArtifactUsage,
  OperationExecutionMode,
  OperationHook,
  OperationInProfile,
  OperationProfileExport,
  OperationProfileUpsertInput,
  OperationTrigger,
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

const templateParamsSchema = z.object({
  template: z.string(),
  strictVariables: z.boolean().optional(),
  writeArtifact: z.object({
    tag: artifactTagSchema,
    persistence: artifactPersistenceSchema,
    usage: artifactUsageSchema,
    semantics: z.string().min(1),
  }),
});

const operationConfigSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  hooks: z.array(operationHookSchema).min(1),
  triggers: z.array(operationTriggerSchema).min(1).optional(),
  order: z.number().finite(),
  dependsOn: z.array(uuidSchema).optional(),
  params: templateParamsSchema,
});

const operationInProfileSchema: z.ZodType<OperationInProfile> = z.object({
  opId: uuidSchema,
  name: z.string().trim().min(1),
  kind: z.literal("template"),
  config: operationConfigSchema,
});

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
  const opIds = new Set<string>();
  for (const op of input.operations) {
    if (opIds.has(op.opId)) {
      throw new HttpError(400, "Duplicate opId in profile", "VALIDATION_ERROR", {
        opId: op.opId,
      });
    }
    opIds.add(op.opId);
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
    }
  }

  if (detectDependencyCycle(input.operations)) {
    throw new HttpError(400, "Dependency cycle detected", "VALIDATION_ERROR");
  }

  const tags = new Map<string, string>(); // tag -> opId
  for (const op of input.operations) {
    const tag = op.config.params.writeArtifact.tag;
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

  const normalizedOps: OperationInProfile[] = parsed.data.operations.map((op) => ({
    ...op,
    config: {
      ...op.config,
      hooks: normalizeHooks(op.config.hooks),
      triggers: normalizeTriggers(op.config.triggers),
      dependsOn: normalizeDependsOn(op.config.dependsOn),
    },
  }));

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

