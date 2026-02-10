import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";


import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { llmPresetSettings, llmPresets } from "../../db/schema";

import {
  listTokens,
  upsertProviderConfig,
  upsertRuntime,
  upsertRuntimeProviderState,
  type LlmRuntimeRow,
  type LlmScope,
} from "./llm-repository";

import type { LlmPresetPayload } from "@shared/types/llm";

const DEFAULT_OWNER_ID = "global";

type LlmPresetRow = typeof llmPresets.$inferSelect;
type LlmPresetSettingsRow = typeof llmPresetSettings.$inferSelect;

const llmPresetPayloadSchema: z.ZodType<LlmPresetPayload> = z
  .object({
    activeProviderId: z.enum(["openrouter", "openai_compatible"]),
    activeModel: z.string().min(1).nullable(),
    activeTokenId: z.string().min(1).nullable(),
    providerConfigsById: z
      .object({
        openrouter: z.record(z.string(), z.unknown()).optional(),
        openai_compatible: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type LlmPresetDto = {
  presetId: string;
  ownerId: string;
  name: string;
  description?: string;
  builtIn: boolean;
  version: number;
  payload: LlmPresetPayload;
  createdAt: Date;
  updatedAt: Date;
};

export type LlmPresetSettingsDto = {
  ownerId: string;
  activePresetId: string | null;
  updatedAt: Date;
};

export type ApplyLlmPresetResult = {
  preset: LlmPresetDto;
  runtime: LlmRuntimeRow;
  warnings: string[];
};

function rowToPreset(row: LlmPresetRow): LlmPresetDto {
  const payload = llmPresetPayloadSchema.parse(
    safeJsonParse(row.payloadJson, {
      activeProviderId: "openrouter",
      activeModel: null,
      activeTokenId: null,
      providerConfigsById: {},
    })
  );
  return {
    presetId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description ?? undefined,
    builtIn: row.builtIn,
    version: row.version,
    payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToSettings(row: LlmPresetSettingsRow): LlmPresetSettingsDto {
  return {
    ownerId: row.ownerId,
    activePresetId: row.activePresetId ?? null,
    updatedAt: row.updatedAt,
  };
}

function normalizePresetPayload(payload: LlmPresetPayload): LlmPresetPayload {
  return llmPresetPayloadSchema.parse(payload);
}

export function resolveAppliedTokenId(params: {
  tokenIds: string[];
  requestedTokenId: string | null;
}): { tokenId: string | null; warning?: string } {
  if (!params.requestedTokenId) return { tokenId: null };
  const valid = params.tokenIds.includes(params.requestedTokenId);
  if (valid) return { tokenId: params.requestedTokenId };
  return {
    tokenId: null,
    warning: `Preset token is missing and was reset: ${params.requestedTokenId}`,
  };
}

export async function ensureDefaultLlmPresetSettings(
  ownerId: string = DEFAULT_OWNER_ID
): Promise<LlmPresetSettingsDto> {
  const db = await initDb();
  const row = await db
    .select()
    .from(llmPresetSettings)
    .where(eq(llmPresetSettings.ownerId, ownerId))
    .limit(1);

  if (row[0]) return rowToSettings(row[0]);

  const now = new Date();
  await db.insert(llmPresetSettings).values({
    ownerId,
    activePresetId: null,
    updatedAt: now,
  });
  return {
    ownerId,
    activePresetId: null,
    updatedAt: now,
  };
}

export async function listLlmPresets(params?: {
  ownerId?: string;
}): Promise<LlmPresetDto[]> {
  const ownerId = params?.ownerId ?? DEFAULT_OWNER_ID;
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmPresets)
    .where(eq(llmPresets.ownerId, ownerId))
    .orderBy(desc(llmPresets.updatedAt));
  return rows.map(rowToPreset);
}

export async function getLlmPresetById(params: {
  presetId: string;
  ownerId?: string;
}): Promise<LlmPresetDto | null> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmPresets)
    .where(and(eq(llmPresets.id, params.presetId), eq(llmPresets.ownerId, ownerId)))
    .limit(1);

  return rows[0] ? rowToPreset(rows[0]) : null;
}

export async function createLlmPreset(params: {
  ownerId?: string;
  name: string;
  description?: string;
  payload: LlmPresetPayload;
}): Promise<LlmPresetDto> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const payload = normalizePresetPayload(params.payload);
  const db = await initDb();
  const now = new Date();
  const presetId = uuidv4();
  await db.insert(llmPresets).values({
    id: presetId,
    ownerId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    builtIn: false,
    version: 1,
    payloadJson: safeJsonStringify(payload, "{}"),
    createdAt: now,
    updatedAt: now,
  });
  const created = await getLlmPresetById({ presetId, ownerId });
  if (!created) throw new HttpError(500, "Failed to create LLM preset");
  return created;
}

export async function updateLlmPreset(params: {
  ownerId?: string;
  presetId: string;
  name?: string;
  description?: string | null;
  payload?: LlmPresetPayload;
}): Promise<LlmPresetDto> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const current = await getLlmPresetById({ presetId: params.presetId, ownerId });
  if (!current) throw new HttpError(404, "LLM preset not found", "NOT_FOUND");
  if (current.builtIn) {
    throw new HttpError(400, "Built-in presets are read-only", "VALIDATION_ERROR");
  }

  const payload = params.payload ? normalizePresetPayload(params.payload) : current.payload;
  const db = await initDb();
  const now = new Date();
  await db
    .update(llmPresets)
    .set({
      name: typeof params.name === "string" ? params.name.trim() : current.name,
      description:
        typeof params.description === "string"
          ? params.description.trim()
          : params.description === null
            ? null
            : current.description ?? null,
      payloadJson: safeJsonStringify(payload, "{}"),
      version: current.version + 1,
      updatedAt: now,
    })
    .where(and(eq(llmPresets.id, params.presetId), eq(llmPresets.ownerId, ownerId)));

  const updated = await getLlmPresetById({ presetId: params.presetId, ownerId });
  if (!updated) throw new HttpError(500, "Failed to update LLM preset");
  return updated;
}

export async function deleteLlmPreset(params: {
  ownerId?: string;
  presetId: string;
}): Promise<void> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const current = await getLlmPresetById({ presetId: params.presetId, ownerId });
  if (!current) throw new HttpError(404, "LLM preset not found", "NOT_FOUND");
  if (current.builtIn) {
    throw new HttpError(400, "Built-in presets cannot be deleted", "VALIDATION_ERROR");
  }

  const db = await initDb();
  await db
    .delete(llmPresets)
    .where(and(eq(llmPresets.id, params.presetId), eq(llmPresets.ownerId, ownerId)));

  const settings = await ensureDefaultLlmPresetSettings(ownerId);
  if (settings.activePresetId === params.presetId) {
    await patchLlmPresetSettings({ ownerId, activePresetId: null });
  }
}

export async function getLlmPresetSettings(params?: {
  ownerId?: string;
}): Promise<LlmPresetSettingsDto> {
  const ownerId = params?.ownerId ?? DEFAULT_OWNER_ID;
  return ensureDefaultLlmPresetSettings(ownerId);
}

export async function patchLlmPresetSettings(params: {
  ownerId?: string;
  activePresetId?: string | null;
}): Promise<LlmPresetSettingsDto> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const current = await ensureDefaultLlmPresetSettings(ownerId);
  const nextActivePresetId =
    typeof params.activePresetId === "undefined"
      ? current.activePresetId
      : params.activePresetId;

  if (nextActivePresetId) {
    const exists = await getLlmPresetById({ presetId: nextActivePresetId, ownerId });
    if (!exists) {
      throw new HttpError(404, "LLM preset not found", "NOT_FOUND");
    }
  }

  const db = await initDb();
  const now = new Date();
  await db
    .update(llmPresetSettings)
    .set({
      activePresetId: nextActivePresetId,
      updatedAt: now,
    })
    .where(eq(llmPresetSettings.ownerId, ownerId));

  return {
    ownerId,
    activePresetId: nextActivePresetId,
    updatedAt: now,
  };
}

export async function applyLlmPreset(params: {
  ownerId?: string;
  presetId: string;
  scope?: LlmScope;
  scopeId?: string;
}): Promise<ApplyLlmPresetResult> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const scope = params.scope ?? "global";
  const scopeId = params.scopeId ?? "global";
  const preset = await getLlmPresetById({ presetId: params.presetId, ownerId });
  if (!preset) throw new HttpError(404, "LLM preset not found", "NOT_FOUND");

  const payload = normalizePresetPayload(preset.payload);
  const configsById = payload.providerConfigsById ?? {};

  const configEntries = Object.entries(configsById) as Array<
    [keyof typeof configsById, unknown]
  >;
  for (const [providerId, providerConfig] of configEntries) {
    if (providerId !== "openrouter" && providerId !== "openai_compatible") continue;
    await upsertProviderConfig(providerId, providerConfig ?? {});
  }

  const providerTokens = await listTokens(payload.activeProviderId);
  const tokenResolution = resolveAppliedTokenId({
    tokenIds: providerTokens.map((item) => item.id),
    requestedTokenId: payload.activeTokenId,
  });

  const runtime = await upsertRuntime({
    scope,
    scopeId,
    activeProviderId: payload.activeProviderId,
    activeTokenId: tokenResolution.tokenId,
    activeModel: payload.activeModel ?? null,
  });
  await upsertRuntimeProviderState({
    scope,
    scopeId,
    providerId: runtime.activeProviderId,
    lastTokenId: runtime.activeTokenId,
    lastModel: runtime.activeModel,
  });

  return {
    preset,
    runtime,
    warnings: tokenResolution.warning ? [tokenResolution.warning] : [],
  };
}
