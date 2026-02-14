import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";
import {
  validateOperationBlockImport,
  validateOperationBlockUpsertInput,
  operationInProfileSchema,
  type ValidatedOperationBlockInput,
} from "./operation-block-validator";

import type {
  OperationExecutionMode,
  OperationProfileBundleProfile,
  OperationProfileExportV2,
  OperationProfileLegacyExportV1,
  OperationProfileUpsertInput,
} from "@shared/types/operation-profiles";

const executionModeSchema = z.enum(["concurrent", "sequential"] satisfies OperationExecutionMode[]);
const uuidSchema = z.string().uuid();

const blockRefSchema = z.object({
  blockId: uuidSchema,
  enabled: z.boolean(),
  order: z.number().finite(),
});

const upsertInputSchema: z.ZodType<OperationProfileUpsertInput> = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  enabled: z.boolean(),
  executionMode: executionModeSchema,
  operationProfileSessionId: uuidSchema,
  blockRefs: z.array(blockRefSchema),
  meta: z.unknown().optional(),
});

export type ValidatedOperationProfileInput = OperationProfileUpsertInput & {
  meta: unknown | null;
};

export type ValidatedOperationProfileBundleImport = {
  kind: "bundle_v2";
  profile: ValidatedOperationProfileInput;
  blocks: Array<ValidatedOperationBlockInput & { importBlockId?: string }>;
};

export type ValidatedOperationProfileLegacyImport = {
  kind: "legacy_v1";
  legacyProfile: Omit<OperationProfileLegacyExportV1, "operations"> & {
    operations: ValidatedOperationBlockInput["operations"];
  };
};

export type ValidatedOperationProfileImportResult =
  | ValidatedOperationProfileBundleImport
  | ValidatedOperationProfileLegacyImport;

function validateProfileCrossRules(input: ValidatedOperationProfileInput): void {
  const byBlockId = new Set<string>();
  for (const ref of input.blockRefs) {
    if (byBlockId.has(ref.blockId)) {
      throw new HttpError(400, "Duplicate blockId in profile", "VALIDATION_ERROR", {
        blockId: ref.blockId,
      });
    }
    byBlockId.add(ref.blockId);
  }
}

export function validateOperationProfileUpsertInput(raw: unknown): ValidatedOperationProfileInput {
  const parsed = upsertInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }

  const validated: ValidatedOperationProfileInput = {
    ...parsed.data,
    blockRefs: parsed.data.blockRefs,
    meta: typeof parsed.data.meta === "undefined" ? null : parsed.data.meta,
  };
  validateProfileCrossRules(validated);
  return validated;
}

const bundleProfileSchema: z.ZodType<OperationProfileBundleProfile> = z.object({
  profileId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  executionMode: executionModeSchema,
  operationProfileSessionId: uuidSchema,
  blockRefs: z.array(blockRefSchema),
  meta: z.unknown().optional(),
});

const bundleImportSchema: z.ZodType<OperationProfileExportV2> = z.object({
  type: z.literal("operation_profile_bundle"),
  version: z.literal(2),
  profile: bundleProfileSchema,
  blocks: z.array(z.object({
    blockId: z.string().uuid().optional(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    operations: z.array(operationInProfileSchema),
    meta: z.unknown().optional(),
  })),
});

const legacyImportSchema: z.ZodType<OperationProfileLegacyExportV1> = z.object({
  profileId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  executionMode: executionModeSchema,
  operationProfileSessionId: uuidSchema,
  operations: z.array(operationInProfileSchema),
  meta: z.unknown().optional(),
});

export function validateOperationProfileImport(raw: unknown): ValidatedOperationProfileImportResult {
  const bundleParsed = bundleImportSchema.safeParse(raw);
  if (bundleParsed.success) {
    const blocks = bundleParsed.data.blocks.map((item) => ({
      ...validateOperationBlockImport(item),
      importBlockId: item.blockId,
    }));
    const profile = validateOperationProfileUpsertInput(bundleParsed.data.profile);
    return { kind: "bundle_v2", profile, blocks };
  }

  const legacyParsed = legacyImportSchema.safeParse(raw);
  if (!legacyParsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: legacyParsed.error.issues,
    });
  }

  const normalizedBlock = validateOperationBlockUpsertInput({
    name: `${legacyParsed.data.name} block`,
    description: legacyParsed.data.description,
    enabled: true,
    operations: legacyParsed.data.operations,
    meta: legacyParsed.data.meta,
  });

  return {
    kind: "legacy_v1",
    legacyProfile: {
      profileId: legacyParsed.data.profileId,
      name: legacyParsed.data.name,
      description: legacyParsed.data.description,
      enabled: legacyParsed.data.enabled,
      executionMode: legacyParsed.data.executionMode,
      operationProfileSessionId: legacyParsed.data.operationProfileSessionId,
      operations: normalizedBlock.operations,
      meta: legacyParsed.data.meta,
    },
  };
}
