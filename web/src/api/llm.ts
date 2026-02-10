import { BASE_URL } from '../const';

import type {
	LlmModel,
	LlmPreset,
	LlmPresetPayload,
	LlmPresetSettings,
	LlmProviderConfig,
	LlmProviderDefinition,
	LlmProviderId,
	LlmRuntime,
	LlmScope,
	LlmTokenListItem,
} from '@shared/types/llm';

type ApiEnvelope<T> = { data: T; error?: unknown };

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	const body = (await res.json().catch(() => ({}))) as Partial<ApiEnvelope<T>> & {
		error?: { message?: string };
	};

	if (!res.ok) {
		const message = body?.error?.message ?? `HTTP error ${res.status}`;
		throw new Error(message);
	}

	return body.data as T;
}

export async function getProviders(): Promise<LlmProviderDefinition[]> {
	const data = await apiJson<{ providers: LlmProviderDefinition[] }>('/llm/providers');
	return data.providers;
}

export async function getRuntime(params: { scope: LlmScope; scopeId: string }): Promise<LlmRuntime> {
	return apiJson<LlmRuntime>(
		`/llm/runtime?scope=${encodeURIComponent(params.scope)}&scopeId=${encodeURIComponent(params.scopeId)}`,
	);
}

export async function patchRuntime(params: {
	scope: LlmScope;
	scopeId: string;
	activeProviderId: LlmProviderId;
	activeTokenId?: string | null;
	activeModel?: string | null;
}): Promise<LlmRuntime> {
	return apiJson<LlmRuntime>('/llm/runtime', {
		method: 'PATCH',
		body: JSON.stringify(params),
	});
}

export async function getProviderConfig(providerId: LlmProviderId): Promise<{
	providerId: LlmProviderId;
	config: LlmProviderConfig;
}> {
	return apiJson<{ providerId: LlmProviderId; config: LlmProviderConfig }>(
		`/llm/providers/${encodeURIComponent(providerId)}/config`,
	);
}

export async function patchProviderConfig(
	providerId: LlmProviderId,
	config: LlmProviderConfig,
): Promise<{
	providerId: LlmProviderId;
	config: LlmProviderConfig;
}> {
	return apiJson<{ providerId: LlmProviderId; config: LlmProviderConfig }>(
		`/llm/providers/${encodeURIComponent(providerId)}/config`,
		{ method: 'PATCH', body: JSON.stringify(config) },
	);
}

export async function listTokens(providerId: LlmProviderId): Promise<LlmTokenListItem[]> {
	const data = await apiJson<{ tokens: LlmTokenListItem[] }>(
		`/llm/tokens?providerId=${encodeURIComponent(providerId)}`,
	);
	return data.tokens;
}

export async function createToken(params: {
	providerId: LlmProviderId;
	name: string;
	token: string;
}): Promise<LlmTokenListItem> {
	return apiJson<LlmTokenListItem>('/llm/tokens', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function patchToken(params: { id: string; name?: string; token?: string }): Promise<void> {
	await apiJson<{ success: true }>(`/llm/tokens/${encodeURIComponent(params.id)}`, {
		method: 'PATCH',
		body: JSON.stringify({ name: params.name, token: params.token }),
	});
}

export async function deleteToken(id: string): Promise<void> {
	await apiJson<{ success: true }>(`/llm/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getModels(params: {
	providerId: LlmProviderId;
	scope: LlmScope;
	scopeId: string;
	tokenId?: string | null;
}): Promise<LlmModel[]> {
	const query = new URLSearchParams({
		providerId: params.providerId,
		scope: params.scope,
		scopeId: params.scopeId,
	});
	if (params.tokenId) query.set('tokenId', params.tokenId);

	const data = await apiJson<{ models: LlmModel[] }>(`/llm/models?${query.toString()}`);
	return data.models;
}

export type LlmPresetDto = Omit<LlmPreset, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

export type LlmPresetSettingsDto = Omit<LlmPresetSettings, 'updatedAt'> & {
	updatedAt: string;
};

export async function listLlmPresets(ownerId = 'global'): Promise<LlmPresetDto[]> {
	return apiJson<LlmPresetDto[]>(`/llm-presets?ownerId=${encodeURIComponent(ownerId)}`);
}

export async function createLlmPreset(input: {
	ownerId?: string;
	name: string;
	description?: string;
	payload: LlmPresetPayload;
}): Promise<LlmPresetDto> {
	return apiJson<LlmPresetDto>('/llm-presets', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export async function updateLlmPreset(input: {
	presetId: string;
	ownerId?: string;
	name?: string;
	description?: string | null;
	payload?: LlmPresetPayload;
}): Promise<LlmPresetDto> {
	return apiJson<LlmPresetDto>(`/llm-presets/${encodeURIComponent(input.presetId)}`, {
		method: 'PUT',
		body: JSON.stringify({
			ownerId: input.ownerId,
			name: input.name,
			description: input.description,
			payload: input.payload,
		}),
	});
}

export async function deleteLlmPreset(input: { presetId: string; ownerId?: string }): Promise<{ id: string }> {
	const query = input.ownerId ? `?ownerId=${encodeURIComponent(input.ownerId)}` : '';
	return apiJson<{ id: string }>(`/llm-presets/${encodeURIComponent(input.presetId)}${query}`, {
		method: 'DELETE',
	});
}

export async function applyLlmPreset(input: {
	presetId: string;
	ownerId?: string;
	scope?: LlmScope;
	scopeId?: string;
}): Promise<{ preset: LlmPresetDto; runtime: LlmRuntime; warnings: string[] }> {
	return apiJson<{ preset: LlmPresetDto; runtime: LlmRuntime; warnings: string[] }>(
		`/llm-presets/${encodeURIComponent(input.presetId)}/apply`,
		{
			method: 'POST',
			body: JSON.stringify({
				ownerId: input.ownerId,
				scope: input.scope,
				scopeId: input.scopeId,
			}),
		},
	);
}

export async function getLlmPresetSettings(ownerId = 'global'): Promise<LlmPresetSettingsDto> {
	return apiJson<LlmPresetSettingsDto>(`/llm-preset-settings?ownerId=${encodeURIComponent(ownerId)}`);
}

export async function patchLlmPresetSettings(input: {
	ownerId?: string;
	activePresetId?: string | null;
}): Promise<LlmPresetSettingsDto> {
	return apiJson<LlmPresetSettingsDto>('/llm-preset-settings', {
		method: 'PUT',
		body: JSON.stringify(input),
	});
}
