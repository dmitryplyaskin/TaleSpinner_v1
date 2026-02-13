import { apiJson } from './api-json';

import type { RagModel, RagPreset, RagPresetSettings, RagProviderConfig, RagProviderDefinition, RagProviderId, RagRuntime } from '@shared/types/rag';
import type { LlmTokenListItem } from '@shared/types/llm';

export async function getRagProviders(): Promise<RagProviderDefinition[]> {
  const data = await apiJson<{ providers: RagProviderDefinition[] }>('/rag/providers');
  return data.providers;
}

export async function getRagRuntime(): Promise<RagRuntime> {
  return apiJson<RagRuntime>('/rag/runtime');
}

export async function patchRagRuntime(payload: Partial<RagRuntime>): Promise<RagRuntime> {
  return apiJson<RagRuntime>('/rag/runtime', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getRagProviderConfig(providerId: RagProviderId): Promise<{ providerId: RagProviderId; config: RagProviderConfig }> {
  return apiJson<{ providerId: RagProviderId; config: RagProviderConfig }>(`/rag/providers/${encodeURIComponent(providerId)}/config`);
}

export async function patchRagProviderConfig(providerId: RagProviderId, config: RagProviderConfig): Promise<{ providerId: RagProviderId; config: RagProviderConfig }> {
  return apiJson<{ providerId: RagProviderId; config: RagProviderConfig }>(`/rag/providers/${encodeURIComponent(providerId)}/config`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

export async function listRagTokens(providerId: RagProviderId): Promise<LlmTokenListItem[]> {
  const data = await apiJson<{ tokens: LlmTokenListItem[] }>(`/rag/tokens?providerId=${encodeURIComponent(providerId)}`);
  return data.tokens;
}

export async function listRagModels(params: { providerId: RagProviderId; tokenId?: string | null }): Promise<RagModel[]> {
  const search = new URLSearchParams({ providerId: params.providerId });
  if (params.tokenId) {
    search.set('tokenId', params.tokenId);
  }
  const data = await apiJson<{ models: RagModel[] }>(`/rag/models?${search.toString()}`);
  return data.models;
}

export async function listRagPresets(): Promise<RagPreset[]> {
  return apiJson<RagPreset[]>('/rag/presets');
}

export async function createRagPreset(input: RagPreset): Promise<RagPreset> {
  return apiJson<RagPreset>('/rag/presets', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateRagPreset(input: RagPreset): Promise<RagPreset> {
  return apiJson<RagPreset>(`/rag/presets/${encodeURIComponent(input.id)}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteRagPreset(id: string): Promise<{ id: string }> {
  return apiJson<{ id: string }>(`/rag/presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function applyRagPreset(id: string): Promise<{ preset: RagPreset | null }> {
  return apiJson<{ preset: RagPreset | null }>(`/rag/presets/${encodeURIComponent(id)}/apply`, { method: 'POST' });
}

export async function getRagPresetSettings(): Promise<RagPresetSettings> {
  return apiJson<RagPresetSettings>('/settings/rag-presets');
}

export async function patchRagPresetSettings(input: RagPresetSettings): Promise<RagPresetSettings> {
  return apiJson<RagPresetSettings>('/settings/rag-presets', { method: 'POST', body: JSON.stringify(input) });
}
