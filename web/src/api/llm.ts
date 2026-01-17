import { BASE_URL } from '../const';

import type {
	LlmModel,
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
