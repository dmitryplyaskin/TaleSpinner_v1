import { BASE_URL } from '../const';

import { apiJson } from './api-json';

export type WorldInfoScope = 'global' | 'chat' | 'entity_profile' | 'persona';
export type WorldInfoBindingRole = 'primary' | 'additional';
export type WorldInfoBookSource = 'native' | 'imported' | 'converted';

export type WorldInfoBookData = {
	name?: string;
	entries: Record<string, unknown>;
	extensions?: Record<string, unknown>;
};

export type WorldInfoBookSummaryDto = {
	id: string;
	ownerId: string;
	slug: string;
	name: string;
	description: string | null;
	source: WorldInfoBookSource;
	version: number;
	updatedAt: string;
};

export type WorldInfoBookDto = {
	id: string;
	ownerId: string;
	slug: string;
	name: string;
	description: string | null;
	data: WorldInfoBookData;
	extensions: Record<string, unknown> | null;
	source: WorldInfoBookSource;
	version: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
};

export type WorldInfoSettingsDto = {
	ownerId: string;
	scanDepth: number;
	minActivations: number;
	minActivationsDepthMax: number;
	budgetPercent: number;
	budgetCapTokens: number;
	contextWindowTokens: number;
	includeNames: boolean;
	recursive: boolean;
	overflowAlert: boolean;
	caseSensitive: boolean;
	matchWholeWords: boolean;
	useGroupScoring: boolean;
	characterStrategy: 0 | 1 | 2;
	maxRecursionSteps: number;
	meta: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
};

export type WorldInfoBindingDto = {
	id: string;
	ownerId: string;
	scope: WorldInfoScope;
	scopeId: string | null;
	bookId: string;
	bindingRole: WorldInfoBindingRole;
	displayOrder: number;
	enabled: boolean;
	meta: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
};

export type WorldInfoBookListResponse = {
	items: WorldInfoBookSummaryDto[];
	nextCursor: number | null;
};

type ApiEnvelope<T> = { data: T; error?: unknown };

async function apiForm<T>(path: string, form: FormData, init?: Omit<RequestInit, 'body'>): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		method: init?.method ?? 'POST',
		body: form,
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

export async function listWorldInfoBooks(params?: {
	ownerId?: string;
	query?: string;
	limit?: number;
	before?: number;
}): Promise<WorldInfoBookListResponse> {
	const query = new URLSearchParams();
	if (typeof params?.ownerId === 'string') query.set('ownerId', params.ownerId);
	if (typeof params?.query === 'string' && params.query.trim().length > 0) query.set('query', params.query.trim());
	if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
	if (typeof params?.before === 'number') query.set('before', String(params.before));
	const suffix = query.size > 0 ? `?${query.toString()}` : '';
	return apiJson<WorldInfoBookListResponse>(`/world-info/books${suffix}`);
}

export async function createWorldInfoBook(params: {
	ownerId?: string;
	name: string;
	slug?: string;
	description?: string;
	data?: unknown;
	extensions?: unknown;
}): Promise<WorldInfoBookDto> {
	return apiJson<WorldInfoBookDto>('/world-info/books', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function getWorldInfoBook(id: string): Promise<WorldInfoBookDto> {
	return apiJson<WorldInfoBookDto>(`/world-info/books/${encodeURIComponent(id)}`);
}

export async function updateWorldInfoBook(params: {
	id: string;
	ownerId?: string;
	name?: string;
	slug?: string;
	description?: string | null;
	data?: unknown;
	extensions?: unknown;
	version?: number;
}): Promise<WorldInfoBookDto> {
	return apiJson<WorldInfoBookDto>(`/world-info/books/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			ownerId: params.ownerId,
			name: params.name,
			slug: params.slug,
			description: params.description,
			data: params.data,
			extensions: params.extensions,
			version: params.version,
		}),
	});
}

export async function deleteWorldInfoBook(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/world-info/books/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
}

export async function duplicateWorldInfoBook(params: {
	id: string;
	ownerId?: string;
	name?: string;
	slug?: string;
}): Promise<WorldInfoBookDto> {
	return apiJson<WorldInfoBookDto>(`/world-info/books/${encodeURIComponent(params.id)}/duplicate`, {
		method: 'POST',
		body: JSON.stringify({ ownerId: params.ownerId, name: params.name, slug: params.slug }),
	});
}

export async function importWorldInfoBook(params: {
	file: File;
	ownerId?: string;
	format?: 'auto' | 'st_native' | 'character_book' | 'agnai' | 'risu' | 'novel';
}): Promise<{ book: WorldInfoBookDto; warnings: string[] }> {
	const form = new FormData();
	form.append('file', params.file);
	if (typeof params.ownerId === 'string') form.append('ownerId', params.ownerId);
	if (typeof params.format === 'string') form.append('format', params.format);
	return apiForm<{ book: WorldInfoBookDto; warnings: string[] }>('/world-info/books/import', form, { method: 'POST' });
}

export async function exportWorldInfoBookToStNative(id: string): Promise<Record<string, unknown>> {
	return apiJson<Record<string, unknown>>(`/world-info/books/${encodeURIComponent(id)}/export?format=st_native`);
}

export async function getWorldInfoSettings(ownerId?: string): Promise<WorldInfoSettingsDto> {
	const suffix = typeof ownerId === 'string' ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
	return apiJson<WorldInfoSettingsDto>(`/world-info/settings${suffix}`);
}

export async function updateWorldInfoSettings(params: {
	ownerId?: string;
	patch: Partial<
		Omit<
			WorldInfoSettingsDto,
			'ownerId' | 'createdAt' | 'updatedAt'
		>
	>;
}): Promise<WorldInfoSettingsDto> {
	return apiJson<WorldInfoSettingsDto>('/world-info/settings', {
		method: 'PUT',
		body: JSON.stringify({ ownerId: params.ownerId, ...params.patch }),
	});
}

export async function listWorldInfoBindings(params?: {
	ownerId?: string;
	scope?: WorldInfoScope;
	scopeId?: string | null;
}): Promise<WorldInfoBindingDto[]> {
	const query = new URLSearchParams();
	if (typeof params?.ownerId === 'string') query.set('ownerId', params.ownerId);
	if (typeof params?.scope === 'string') query.set('scope', params.scope);
	if (typeof params?.scopeId === 'string') query.set('scopeId', params.scopeId);
	const suffix = query.size > 0 ? `?${query.toString()}` : '';
	return apiJson<WorldInfoBindingDto[]>(`/world-info/bindings${suffix}`);
}

export async function replaceWorldInfoBindings(params: {
	ownerId?: string;
	scope: WorldInfoScope;
	scopeId?: string | null;
	items: Array<{
		bookId: string;
		bindingRole?: WorldInfoBindingRole;
		displayOrder?: number;
		enabled?: boolean;
	}>;
}): Promise<WorldInfoBindingDto[]> {
	return apiJson<WorldInfoBindingDto[]>('/world-info/bindings', {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}
