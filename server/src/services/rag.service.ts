import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { BaseService } from '@core/services/base-service';
import { ConfigService } from '@core/services/config-service';
import { getTokenPlaintext, listTokens } from '@services/llm/llm-repository';

import type {
  RagModel,
  RagPreset,
  RagPresetPayload,
  RagPresetSettings,
  RagProviderConfig,
  RagProviderDefinition,
  RagProviderId,
  RagRuntime,
} from '@shared/types/rag';

const MODELS_REQUEST_TIMEOUT_MS = 7000;
const DEFAULT_RAG_PRESET_NAME = 'Default RAG preset';

const ragProviderIdSchema = z.enum(['openrouter', 'ollama'] satisfies RagProviderId[]);

const ragRuntimeSchema = z.object({
  activeProviderId: ragProviderIdSchema,
  activeTokenId: z.string().nullable(),
  activeModel: z.string().nullable(),
});

const ragConfigSchema = z.object({
  baseUrl: z.string().min(1).optional(),
  defaultModel: z.string().min(1).optional(),
  dimensions: z.number().int().positive().optional(),
  encodingFormat: z.enum(['float', 'base64']).optional(),
  user: z.string().min(1).optional(),
  keepAlive: z.string().min(1).optional(),
  truncate: z.boolean().optional(),
}).passthrough();

const ragProviderConfigsByIdSchema = z.object({
  openrouter: ragConfigSchema.optional(),
  ollama: ragConfigSchema.optional(),
}).partial();

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

export const ragPresetSettingsSchema = z.object({
  selectedId: z.string().min(1).nullable().optional(),
}).passthrough();

class RagPresets extends BaseService<RagPreset> {
  constructor() {
    super('rag-presets');
  }
}

class RagPresetSettingsConfig extends ConfigService<RagPresetSettings> {
  constructor() {
    super('rag-presets.json', { logger: console });
  }

  getDefaultConfig(): RagPresetSettings {
    return { selectedId: null };
  }
}

class RagRuntimeConfig extends ConfigService<RagRuntime> {
  constructor() {
    super('rag-runtime.json', { logger: console });
  }

  getDefaultConfig(): RagRuntime {
    return {
      activeProviderId: 'openrouter',
      activeTokenId: null,
      activeModel: null,
      activeTokenHint: null,
    };
  }
}

class RagProviderConfigService extends ConfigService<Record<RagProviderId, RagProviderConfig>> {
  constructor() {
    super('rag-provider-configs.json', { logger: console });
  }

  getDefaultConfig(): Record<RagProviderId, RagProviderConfig> {
    return {
      openrouter: { defaultModel: 'text-embedding-3-small', encodingFormat: 'float' },
      ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'nomic-embed-text', truncate: true, keepAlive: '5m' },
    };
  }
}

export const ragProviderDefinitions: RagProviderDefinition[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: true,
    requiresToken: true,
    supportsModels: true,
    configFields: [
      { key: 'defaultModel', label: 'Default embedding model', type: 'text', required: false, placeholder: 'openai/text-embedding-3-small' },
      { key: 'dimensions', label: 'Dimensions', type: 'number', required: false },
      {
        key: 'encodingFormat',
        label: 'Encoding format',
        type: 'select',
        required: false,
        options: [
          { value: 'float', label: 'float' },
          { value: 'base64', label: 'base64' },
        ],
      },
      { key: 'user', label: 'User', type: 'text', required: false, placeholder: 'optional user id' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    enabled: true,
    requiresToken: false,
    supportsModels: false,
    configFields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', required: true, placeholder: 'http://localhost:11434' },
      { key: 'defaultModel', label: 'Default embedding model', type: 'text', required: false, placeholder: 'nomic-embed-text' },
      { key: 'keepAlive', label: 'Keep alive', type: 'text', required: false, placeholder: '5m' },
    ],
  },
];

export const ragService = {
  presets: new RagPresets(),
  presetSettings: new RagPresetSettingsConfig(),
  runtime: new RagRuntimeConfig(),
  providerConfigs: new RagProviderConfigService(),
};

let ensureRagPresetStateInFlight: Promise<{ presets: RagPreset[]; settings: RagPresetSettings }> | null = null;

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
        openrouter: payload.providerConfigsById.openrouter ? normalizeRagConfig(payload.providerConfigsById.openrouter) : undefined,
        ollama: payload.providerConfigsById.ollama ? normalizeRagConfig(payload.providerConfigsById.ollama) : undefined,
      },
    },
  };
}

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

async function ensureRagPresetStateUnsafe(): Promise<{ presets: RagPreset[]; settings: RagPresetSettings }> {
  const rawPresets = await ragService.presets.getAll();
  const normalizedPresets: RagPreset[] = [];

  for (const rawPreset of rawPresets) {
    const normalized = normalizeRagPreset(rawPreset);
    if (!normalized) {
      console.warn('Skipping invalid RAG preset payload', { id: (rawPreset as { id?: unknown })?.id });
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

export async function ensureRagPresetState(): Promise<{ presets: RagPreset[]; settings: RagPresetSettings }> {
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
  if (providerId !== 'openrouter') return [];
  return listTokens('openrouter');
}

export async function listRagModels(params: {
  providerId: RagProviderId;
  tokenId: string | null;
}): Promise<RagModel[]> {
  if (params.providerId !== 'openrouter') {
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
    const response = await axios.get('https://openrouter.ai/api/v1/embeddings/models', {
      headers: {
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'TaleSpinner',
        Authorization: `Bearer ${token}`,
      },
      timeout: MODELS_REQUEST_TIMEOUT_MS,
    });

    const rawItems = Array.isArray(response.data?.data)
      ? response.data.data as Array<{ id?: unknown; name?: unknown }>
      : [];

    return rawItems
      .filter((item) => typeof item?.id === 'string' && item.id.length > 0)
      .map((item) => ({
        id: item.id as string,
        name: typeof item.name === 'string' && item.name.length > 0 ? item.name : item.id as string,
      }));
  } catch (error) {
    console.warn('Failed to fetch RAG embedding models', {
      providerId: params.providerId,
      error,
    });
    return [];
  }
}

export async function getRagRuntime(): Promise<RagRuntime> {
  const runtime = ragRuntimeSchema.parse(await ragService.runtime.getConfig());
  if (!runtime.activeTokenId || runtime.activeProviderId !== 'openrouter') {
    return { ...runtime, activeTokenHint: null };
  }
  const tokens = await listTokens('openrouter');
  const active = tokens.find((token) => token.id === runtime.activeTokenId) ?? null;
  return { ...runtime, activeTokenHint: active?.tokenHint ?? null };
}

export async function patchRagRuntime(patch: Partial<RagRuntime>): Promise<RagRuntime> {
  const current = await ragService.runtime.getConfig();
  const next = ragRuntimeSchema.parse({ ...current, ...patch });
  await ragService.runtime.saveConfig({ ...next, activeTokenHint: null });
  return getRagRuntime();
}

export async function getRagProviderConfig(providerId: RagProviderId): Promise<RagProviderConfig> {
  const all = await ragService.providerConfigs.getConfig();
  return ragConfigSchema.parse(all[providerId] ?? {});
}

export async function patchRagProviderConfig(providerId: RagProviderId, patch: RagProviderConfig): Promise<RagProviderConfig> {
  const all = await ragService.providerConfigs.getConfig();
  const nextProviderConfig = ragConfigSchema.parse({ ...(all[providerId] ?? {}), ...patch });
  const next = { ...all, [providerId]: nextProviderConfig };
  await ragService.providerConfigs.saveConfig(next);
  return nextProviderConfig;
}

export async function generateRagEmbedding(params: { input: string | string[] }) {
  const runtime = await getRagRuntime();
  const model = runtime.activeModel;
  if (!model) throw new Error('No active embedding model selected');

  const providerConfig = await getRagProviderConfig(runtime.activeProviderId);

  if (runtime.activeProviderId === 'openrouter') {
    if (!runtime.activeTokenId) throw new Error('OpenRouter token is required');
    const token = await getTokenPlaintext(runtime.activeTokenId);
    if (!token) throw new Error('OpenRouter token not found');

    const response = await axios.post('https://openrouter.ai/api/v1/embeddings', {
      model,
      input: params.input,
      dimensions: providerConfig.dimensions,
      encoding_format: providerConfig.encodingFormat,
      user: providerConfig.user,
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    return response.data;
  }

  const ollamaBaseUrl = typeof providerConfig.baseUrl === 'string' ? providerConfig.baseUrl : 'http://localhost:11434';
  const response = await axios.post(`${ollamaBaseUrl.replace(/\/$/, '')}/api/embed`, {
    model,
    input: params.input,
    truncate: providerConfig.truncate,
    keep_alive: providerConfig.keepAlive,
  }, {
    timeout: 20000,
  });

  return response.data;
}

