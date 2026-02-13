import axios from 'axios';
import { z } from 'zod';

import { BaseService } from '@core/services/base-service';
import { ConfigService } from '@core/services/config-service';
import { getTokenPlaintext, listTokens } from '@services/llm/llm-repository';

import type { RagPreset, RagPresetSettings, RagProviderConfig, RagProviderDefinition, RagProviderId, RagRuntime } from '@shared/types/rag';

const ragRuntimeSchema = z.object({
  activeProviderId: z.enum(['openrouter', 'ollama'] satisfies RagProviderId[]),
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
    return { selectedId: null, enabled: true };
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
    supportsModels: false,
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

export async function listRagTokens(providerId: RagProviderId) {
  if (providerId !== 'openrouter') return [];
  return listTokens('openrouter');
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

