import { randomUUID as uuidv4 } from "node:crypto";

import axios from "axios";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";
import { getTokenPlaintext, listTokens } from "@services/llm/llm-repository";
import { probeRagProviderConnection } from "@services/rag/rag-connection-check";

import { safeJsonParse, safeJsonStringify } from "../chat-core/json";
import { initDb } from "../db/client";
import {
  ragPresetSettings,
  ragPresets,
  ragProviderConfigs,
  ragRuntimeSettings,
} from "../db/schema";

import type {
  RagModel,
  RagPreset,
  RagPresetPayload,
  RagPresetSettings,
  RagProviderConfig,
  RagProviderConnectionCheckResult,
  RagProviderDefinition,
  RagProviderId,
  RagRuntime,
} from "@shared/types/rag";

const MODELS_REQUEST_TIMEOUT_MS = 7000;
const DEFAULT_RAG_PRESET_NAME = "Default RAG preset";
const DEFAULT_OWNER_ID = "global";
const RUNTIME_ROW_ID = "global";

const DEFAULT_PROVIDER_CONFIGS: Record<RagProviderId, RagProviderConfig> = {
  openrouter: { defaultModel: "text-embedding-3-small", encodingFormat: "float" },
  ollama: {
    baseUrl: "http://localhost:11434",
    defaultModel: "nomic-embed-text",
    truncate: true,
    keepAlive: "5m",
  },
};

const DEFAULT_RAG_RUNTIME: RagRuntime = {
  activeProviderId: "openrouter",
  activeTokenId: null,
  activeModel: null,
  activeTokenHint: null,
};

const FALLBACK_PRESET_PAYLOAD: RagPresetPayload = {
  activeProviderId: "openrouter",
  activeTokenId: null,
  activeModel: null,
  providerConfigsById: {},
};

const ragProviderIdSchema = z.enum(["openrouter", "ollama"] satisfies RagProviderId[]);

const ragRuntimeSchema = z.object({
  activeProviderId: ragProviderIdSchema,
  activeTokenId: z.string().nullable(),
  activeModel: z.string().nullable(),
});

const ragConfigSchema = z
  .object({
    baseUrl: z.string().min(1).optional(),
    defaultModel: z.string().min(1).optional(),
    dimensions: z.number().int().positive().optional(),
    encodingFormat: z.enum(["float", "base64"]).optional(),
    user: z.string().min(1).optional(),
    keepAlive: z.string().min(1).optional(),
    truncate: z.boolean().optional(),
  })
  .passthrough();

const ragProviderConfigsByIdSchema = z
  .object({
    openrouter: ragConfigSchema.optional(),
    ollama: ragConfigSchema.optional(),
  })
  .partial();

export const ragPresetPayloadSchema = z.object({
  activeProviderId: ragProviderIdSchema,
  activeTokenId: z.string().min(1).nullable(),
  activeModel: z.string().min(1).nullable(),
  providerConfigsById: ragProviderConfigsByIdSchema,
});

export const ragPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  payload: ragPresetPayloadSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ragPresetSettingsSchema = z
  .object({
    selectedId: z.string().min(1).nullable().optional(),
  })
  .passthrough();

function toDate(input: unknown, fallback: Date): Date {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? fallback : input;
  }
  if (typeof input === "number" || typeof input === "string") {
    const next = new Date(input);
    return Number.isNaN(next.getTime()) ? fallback : next;
  }
  return fallback;
}

function toIso(input: unknown, fallback: Date): string {
  return toDate(input, fallback).toISOString();
}

function normalizeRagConfig(input: unknown): RagProviderConfig {
  const parsed = ragConfigSchema.safeParse(input ?? {});
  if (!parsed.success) return {};
  return parsed.data;
}

function normalizeRagPreset(input: unknown): RagPreset | null {
  const parsed = ragPresetSchema.safeParse(input);
  if (!parsed.success) return null;

  const payload = parsed.data.payload;
  return {
    ...parsed.data,
    payload: {
      ...payload,
      providerConfigsById: {
        openrouter: payload.providerConfigsById.openrouter
          ? normalizeRagConfig(payload.providerConfigsById.openrouter)
          : undefined,
        ollama: payload.providerConfigsById.ollama
          ? normalizeRagConfig(payload.providerConfigsById.ollama)
          : undefined,
      },
    },
  };
}

function parsePresetPayload(payloadJson: string): RagPresetPayload {
  const raw = safeJsonParse<unknown>(payloadJson, null);
  const parsed = ragPresetPayloadSchema.safeParse(raw);
  if (!parsed.success) return FALLBACK_PRESET_PAYLOAD;

  return {
    ...parsed.data,
    providerConfigsById: {
      openrouter: parsed.data.providerConfigsById.openrouter
        ? normalizeRagConfig(parsed.data.providerConfigsById.openrouter)
        : undefined,
      ollama: parsed.data.providerConfigsById.ollama
        ? normalizeRagConfig(parsed.data.providerConfigsById.ollama)
        : undefined,
    },
  };
}

function rowToRagPreset(row: typeof ragPresets.$inferSelect): RagPreset {
  const now = new Date();
  return {
    id: row.id,
    name: row.name,
    payload: parsePresetPayload(row.payloadJson),
    createdAt: toIso(row.createdAt, now),
    updatedAt: toIso(row.updatedAt, now),
  };
}

function rowToRagRuntime(row: typeof ragRuntimeSettings.$inferSelect): RagRuntime {
  const parsed = ragRuntimeSchema.safeParse({
    activeProviderId: row.activeProviderId,
    activeTokenId: row.activeTokenId,
    activeModel: row.activeModel,
  });

  if (!parsed.success) {
    return { ...DEFAULT_RAG_RUNTIME };
  }

  return {
    ...parsed.data,
    activeTokenHint: null,
  };
}

function rowToPresetSettings(
  row: typeof ragPresetSettings.$inferSelect
): RagPresetSettings {
  return {
    selectedId: row.selectedId ?? null,
  };
}

async function getRagPresetRowById(
  id: string
): Promise<typeof ragPresets.$inferSelect | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(ragPresets)
    .where(and(eq(ragPresets.id, id), eq(ragPresets.ownerId, DEFAULT_OWNER_ID)))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertRagPreset(input: RagPreset): Promise<RagPreset> {
  const parsed = ragPresetSchema.parse(input);
  const db = await initDb();
  const now = new Date();
  const createdAt = toDate(parsed.createdAt, now);
  const updatedAt = toDate(parsed.updatedAt, now);

  await db
    .insert(ragPresets)
    .values({
      id: parsed.id,
      ownerId: DEFAULT_OWNER_ID,
      name: parsed.name,
      payloadJson: safeJsonStringify(parsed.payload, "{}"),
      createdAt,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: ragPresets.id,
      set: {
        ownerId: DEFAULT_OWNER_ID,
        name: parsed.name,
        payloadJson: safeJsonStringify(parsed.payload, "{}"),
        createdAt,
        updatedAt,
      },
    });

  const row = await getRagPresetRowById(parsed.id);
  if (!row) throw new HttpError(500, "Failed to save RAG preset");
  return rowToRagPreset(row);
}

async function ensureRuntimeRow(): Promise<typeof ragRuntimeSettings.$inferSelect> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(ragRuntimeSettings)
    .where(eq(ragRuntimeSettings.id, RUNTIME_ROW_ID))
    .limit(1);

  if (rows[0]) return rows[0];

  const now = new Date();
  await db.insert(ragRuntimeSettings).values({
    id: RUNTIME_ROW_ID,
    activeProviderId: DEFAULT_RAG_RUNTIME.activeProviderId,
    activeTokenId: DEFAULT_RAG_RUNTIME.activeTokenId,
    activeModel: DEFAULT_RAG_RUNTIME.activeModel,
    updatedAt: now,
  });

  return {
    id: RUNTIME_ROW_ID,
    activeProviderId: DEFAULT_RAG_RUNTIME.activeProviderId,
    activeTokenId: DEFAULT_RAG_RUNTIME.activeTokenId,
    activeModel: DEFAULT_RAG_RUNTIME.activeModel,
    updatedAt: now,
  };
}

async function ensurePresetSettingsRow(): Promise<
  typeof ragPresetSettings.$inferSelect
> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(ragPresetSettings)
    .where(eq(ragPresetSettings.ownerId, DEFAULT_OWNER_ID))
    .limit(1);

  if (rows[0]) return rows[0];

  const now = new Date();
  await db.insert(ragPresetSettings).values({
    ownerId: DEFAULT_OWNER_ID,
    selectedId: null,
    updatedAt: now,
  });

  return {
    ownerId: DEFAULT_OWNER_ID,
    selectedId: null,
    updatedAt: now,
  };
}

async function ensureDefaultProviderConfigs(): Promise<void> {
  const db = await initDb();
  const now = new Date();

  const defaults: Array<[RagProviderId, RagProviderConfig]> = [
    ["openrouter", DEFAULT_PROVIDER_CONFIGS.openrouter],
    ["ollama", DEFAULT_PROVIDER_CONFIGS.ollama],
  ];

  for (const [providerId, config] of defaults) {
    await db
      .insert(ragProviderConfigs)
      .values({
        providerId,
        configJson: safeJsonStringify(config, "{}"),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: ragProviderConfigs.providerId });
  }
}

export const ragProviderDefinitions: RagProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    enabled: true,
    requiresToken: true,
    supportsModels: true,
    configFields: [
      {
        key: "defaultModel",
        label: "Default embedding model",
        type: "text",
        required: false,
        placeholder: "openai/text-embedding-3-small",
      },
      { key: "dimensions", label: "Dimensions", type: "number", required: false },
      {
        key: "encodingFormat",
        label: "Encoding format",
        type: "select",
        required: false,
        options: [
          { value: "float", label: "float" },
          { value: "base64", label: "base64" },
        ],
      },
      {
        key: "user",
        label: "User",
        type: "text",
        required: false,
        placeholder: "optional user id",
      },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    enabled: true,
    requiresToken: false,
    supportsModels: false,
    configFields: [
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        required: true,
        placeholder: "http://localhost:11434",
      },
      {
        key: "defaultModel",
        label: "Default embedding model",
        type: "text",
        required: false,
        placeholder: "nomic-embed-text",
      },
      {
        key: "keepAlive",
        label: "Keep alive",
        type: "text",
        required: false,
        placeholder: "5m",
      },
    ],
  },
];

export const ragService = {
  presets: {
    async getAll(): Promise<RagPreset[]> {
      const db = await initDb();
      const rows = await db
        .select()
        .from(ragPresets)
        .where(eq(ragPresets.ownerId, DEFAULT_OWNER_ID))
        .orderBy(desc(ragPresets.createdAt));

      return rows.map(rowToRagPreset);
    },

    async create(data: RagPreset): Promise<RagPreset> {
      return upsertRagPreset(data);
    },

    async update(data: RagPreset): Promise<RagPreset> {
      return upsertRagPreset(data);
    },

    async delete(id: string): Promise<string> {
      const db = await initDb();
      const row = await getRagPresetRowById(id);
      if (!row) throw new HttpError(404, "Not found", "NOT_FOUND", { id });

      await db
        .delete(ragPresets)
        .where(and(eq(ragPresets.id, id), eq(ragPresets.ownerId, DEFAULT_OWNER_ID)));

      return id;
    },
  },

  presetSettings: {
    async getConfig(): Promise<RagPresetSettings> {
      const row = await ensurePresetSettingsRow();
      return rowToPresetSettings(row);
    },

    async saveConfig(config: RagPresetSettings): Promise<RagPresetSettings> {
      const db = await initDb();
      const now = new Date();
      const next = {
        selectedId: config.selectedId ?? null,
      };

      await db
        .insert(ragPresetSettings)
        .values({
          ownerId: DEFAULT_OWNER_ID,
          selectedId: next.selectedId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: ragPresetSettings.ownerId,
          set: {
            selectedId: next.selectedId,
            updatedAt: now,
          },
        });

      return next;
    },
  },

  runtime: {
    async getConfig(): Promise<RagRuntime> {
      const row = await ensureRuntimeRow();
      return rowToRagRuntime(row);
    },

    async saveConfig(config: RagRuntime): Promise<RagRuntime> {
      const db = await initDb();
      const parsed = ragRuntimeSchema.parse(config);
      const now = new Date();

      await db
        .insert(ragRuntimeSettings)
        .values({
          id: RUNTIME_ROW_ID,
          activeProviderId: parsed.activeProviderId,
          activeTokenId: parsed.activeTokenId,
          activeModel: parsed.activeModel,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: ragRuntimeSettings.id,
          set: {
            activeProviderId: parsed.activeProviderId,
            activeTokenId: parsed.activeTokenId,
            activeModel: parsed.activeModel,
            updatedAt: now,
          },
        });

      return {
        ...parsed,
        activeTokenHint: null,
      };
    },
  },

  providerConfigs: {
    async getConfig(): Promise<Record<RagProviderId, RagProviderConfig>> {
      await ensureDefaultProviderConfigs();
      const db = await initDb();
      const rows = await db.select().from(ragProviderConfigs);
      const map = new Map(rows.map((row) => [row.providerId as RagProviderId, row]));

      const openrouterRaw = map.get("openrouter")?.configJson;
      const ollamaRaw = map.get("ollama")?.configJson;

      return {
        openrouter: normalizeRagConfig(
          openrouterRaw
            ? safeJsonParse(openrouterRaw, DEFAULT_PROVIDER_CONFIGS.openrouter)
            : DEFAULT_PROVIDER_CONFIGS.openrouter
        ),
        ollama: normalizeRagConfig(
          ollamaRaw
            ? safeJsonParse(ollamaRaw, DEFAULT_PROVIDER_CONFIGS.ollama)
            : DEFAULT_PROVIDER_CONFIGS.ollama
        ),
      };
    },

    async saveConfig(
      config: Record<RagProviderId, RagProviderConfig>
    ): Promise<Record<RagProviderId, RagProviderConfig>> {
      const db = await initDb();
      const current = await ragService.providerConfigs.getConfig();
      const now = new Date();
      const next: Record<RagProviderId, RagProviderConfig> = {
        openrouter: normalizeRagConfig(config.openrouter ?? current.openrouter ?? {}),
        ollama: normalizeRagConfig(config.ollama ?? current.ollama ?? {}),
      };

      for (const providerId of ["openrouter", "ollama"] satisfies RagProviderId[]) {
        await db
          .insert(ragProviderConfigs)
          .values({
            providerId,
            configJson: safeJsonStringify(next[providerId], "{}"),
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: ragProviderConfigs.providerId,
            set: {
              configJson: safeJsonStringify(next[providerId], "{}"),
              updatedAt: now,
            },
          });
      }

      return next;
    },
  },
};

let ensureRagPresetStateInFlight: Promise<{
  presets: RagPreset[];
  settings: RagPresetSettings;
}> | null = null;

export function normalizeRagPresetSettings(input: unknown): RagPresetSettings {
  const parsed = ragPresetSettingsSchema.safeParse(input);
  if (!parsed.success) return { selectedId: null };
  return { selectedId: parsed.data.selectedId ?? null };
}

async function buildRagPresetPayloadSnapshot(): Promise<RagPresetPayload> {
  const [runtimeRaw, providerConfigsRaw] = await Promise.all([
    ragService.runtime.getConfig(),
    ragService.providerConfigs.getConfig(),
  ]);
  const runtime = ragRuntimeSchema.parse(runtimeRaw);

  return {
    activeProviderId: runtime.activeProviderId,
    activeTokenId: runtime.activeTokenId ?? null,
    activeModel: runtime.activeModel ?? null,
    providerConfigsById: {
      openrouter: normalizeRagConfig(providerConfigsRaw.openrouter ?? {}),
      ollama: normalizeRagConfig(providerConfigsRaw.ollama ?? {}),
    },
  };
}

async function ensureRagPresetStateUnsafe(): Promise<{
  presets: RagPreset[];
  settings: RagPresetSettings;
}> {
  const rawPresets = await ragService.presets.getAll();
  const normalizedPresets: RagPreset[] = [];

  for (const rawPreset of rawPresets) {
    const normalized = normalizeRagPreset(rawPreset);
    if (!normalized) {
      console.warn("Skipping invalid RAG preset payload", {
        id: (rawPreset as { id?: unknown })?.id,
      });
      continue;
    }
    normalizedPresets.push(normalized);

    if (JSON.stringify(rawPreset) !== JSON.stringify(normalized)) {
      await ragService.presets.update(normalized);
    }
  }

  if (normalizedPresets.length === 0) {
    const now = new Date().toISOString();
    const created = await ragService.presets.create({
      id: uuidv4(),
      name: DEFAULT_RAG_PRESET_NAME,
      payload: await buildRagPresetPayloadSnapshot(),
      createdAt: now,
      updatedAt: now,
    });
    normalizedPresets.push(created);
  }

  const currentSettingsRaw = await ragService.presetSettings.getConfig();
  let nextSettings = normalizeRagPresetSettings(currentSettingsRaw);
  const presetIds = new Set(normalizedPresets.map((item) => item.id));

  if (!nextSettings.selectedId || !presetIds.has(nextSettings.selectedId)) {
    nextSettings = { selectedId: normalizedPresets[0]?.id ?? null };
  }

  if (JSON.stringify(currentSettingsRaw) !== JSON.stringify(nextSettings)) {
    await ragService.presetSettings.saveConfig(nextSettings);
  }

  return { presets: normalizedPresets, settings: nextSettings };
}

export async function ensureRagPresetState(): Promise<{
  presets: RagPreset[];
  settings: RagPresetSettings;
}> {
  if (ensureRagPresetStateInFlight) {
    return ensureRagPresetStateInFlight;
  }

  ensureRagPresetStateInFlight = ensureRagPresetStateUnsafe();
  try {
    return await ensureRagPresetStateInFlight;
  } finally {
    ensureRagPresetStateInFlight = null;
  }
}

export async function bootstrapRag(): Promise<void> {
  await ensureRagPresetState();
}

export async function listRagTokens(providerId: RagProviderId) {
  if (providerId !== "openrouter") return [];
  return listTokens("openrouter");
}

export async function listRagModels(params: {
  providerId: RagProviderId;
  tokenId: string | null;
}): Promise<RagModel[]> {
  if (params.providerId !== "openrouter") {
    return [];
  }
  if (!params.tokenId) {
    return [];
  }

  const token = await getTokenPlaintext(params.tokenId);
  if (!token) {
    return [];
  }

  try {
    const response = await axios.get("https://openrouter.ai/api/v1/embeddings/models", {
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        Authorization: `Bearer ${token}`,
      },
      timeout: MODELS_REQUEST_TIMEOUT_MS,
    });

    const rawItems = Array.isArray(response.data?.data)
      ? (response.data.data as Array<{ id?: unknown; name?: unknown }>)
      : [];

    return rawItems
      .filter((item) => typeof item?.id === "string" && item.id.length > 0)
      .map((item) => ({
        id: item.id as string,
        name:
          typeof item.name === "string" && item.name.length > 0
            ? item.name
            : (item.id as string),
      }));
  } catch (error) {
    console.warn("Failed to fetch RAG embedding models", {
      providerId: params.providerId,
      error,
    });
    return [];
  }
}

export async function checkRagProviderConnection(params: {
  providerId: RagProviderId;
  tokenId: string | null;
  configOverride?: RagProviderConfig;
}): Promise<RagProviderConnectionCheckResult> {
  const savedConfig = await getRagProviderConfig(params.providerId);
  const config = ragConfigSchema.parse({ ...savedConfig, ...(params.configOverride ?? {}) });
  return probeRagProviderConnection({ ...params, config });
}

export async function getRagRuntime(): Promise<RagRuntime> {
  const runtime = ragRuntimeSchema.parse(await ragService.runtime.getConfig());
  if (!runtime.activeTokenId || runtime.activeProviderId !== "openrouter") {
    return { ...runtime, activeTokenHint: null };
  }
  const tokens = await listTokens("openrouter");
  const active = tokens.find((token) => token.id === runtime.activeTokenId) ?? null;
  return { ...runtime, activeTokenHint: active?.tokenHint ?? null };
}

export async function patchRagRuntime(
  patch: Partial<RagRuntime>
): Promise<RagRuntime> {
  const current = await ragService.runtime.getConfig();
  const next = ragRuntimeSchema.parse({ ...current, ...patch });
  await ragService.runtime.saveConfig({ ...next, activeTokenHint: null });
  return getRagRuntime();
}

export async function getRagProviderConfig(
  providerId: RagProviderId
): Promise<RagProviderConfig> {
  const all = await ragService.providerConfigs.getConfig();
  return ragConfigSchema.parse(all[providerId] ?? {});
}

export async function patchRagProviderConfig(
  providerId: RagProviderId,
  patch: RagProviderConfig
): Promise<RagProviderConfig> {
  const all = await ragService.providerConfigs.getConfig();
  const nextProviderConfig = ragConfigSchema.parse({
    ...(all[providerId] ?? {}),
    ...patch,
  });
  const next = { ...all, [providerId]: nextProviderConfig };
  await ragService.providerConfigs.saveConfig(next);
  return nextProviderConfig;
}

export async function generateRagEmbedding(params: { input: string | string[] }) {
  const runtime = await getRagRuntime();
  const model = runtime.activeModel;
  if (!model) throw new Error("No active embedding model selected");

  const providerConfig = await getRagProviderConfig(runtime.activeProviderId);

  if (runtime.activeProviderId === "openrouter") {
    if (!runtime.activeTokenId) throw new Error("OpenRouter token is required");
    const token = await getTokenPlaintext(runtime.activeTokenId);
    if (!token) throw new Error("OpenRouter token not found");

    const response = await axios.post(
      "https://openrouter.ai/api/v1/embeddings",
      {
        model,
        input: params.input,
        dimensions: providerConfig.dimensions,
        encoding_format: providerConfig.encodingFormat,
        user: providerConfig.user,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    return response.data;
  }

  const ollamaBaseUrl =
    typeof providerConfig.baseUrl === "string"
      ? providerConfig.baseUrl
      : "http://localhost:11434";
  const response = await axios.post(
    `${ollamaBaseUrl.replace(/\/$/, "")}/api/embed`,
    {
      model,
      input: params.input,
      truncate: providerConfig.truncate,
      keep_alive: providerConfig.keepAlive,
    },
    {
      timeout: 20000,
    }
  );

  return response.data;
}
