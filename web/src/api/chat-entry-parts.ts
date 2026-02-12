import { BASE_URL } from '../const';

import type { SseEnvelope } from './chat-core';
import type { Variant, Entry } from '@shared/types/chat-entry-parts';

type ApiEnvelope<T> = { data: T; error?: unknown };

const CHAT_GENERATION_DEBUG_STORAGE_KEY = 'chat_generation_debug';
const CHAT_GENERATION_DEBUG_SETTINGS_KEY = '__chatGenerationDebug';

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

function makeRequestId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isChatGenerationDebugEnabledClient(): boolean {
	if (typeof window === 'undefined') return false;
	const win = window as Window & { __chatGenerationDebug?: boolean };
	if (typeof win.__chatGenerationDebug === 'boolean') return win.__chatGenerationDebug;
	try {
		const raw = window.localStorage.getItem(CHAT_GENERATION_DEBUG_STORAGE_KEY);
		if (raw === '1' || raw === 'true') return true;
		if (raw === '0' || raw === 'false') return false;
	} catch {
		// ignore storage access errors
	}
	return import.meta.env.DEV;
}

function withChatGenerationDebugSettings(settings: Record<string, unknown> | undefined): Record<string, unknown> {
	const next = { ...(settings ?? {}) };
	if (isChatGenerationDebugEnabledClient()) {
		next[CHAT_GENERATION_DEBUG_SETTINGS_KEY] = true;
	}
	return next;
}

export type ChatEntryWithVariantDto = {
	entry: Entry;
	variant: Variant | null;
};

export type PromptDiagnosticsResponse = {
	generationId: string;
	entryId: string;
	variantId: string;
	startedAt: string;
	status: 'streaming' | 'done' | 'aborted' | 'error';
	estimator: 'chars_div4';
	prompt: {
		messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
		approxTokens: {
			total: number;
			byRole: { system: number; user: number; assistant: number };
			sections: {
				systemInstruction: number;
				chatHistory: number;
				worldInfoBefore: number;
				worldInfoAfter: number;
				worldInfoDepth: number;
				worldInfoOutlets: number;
				worldInfoAN: number;
				worldInfoEM: number;
			};
		};
	};
	turnCanonicalizations: Array<{
		hook: 'before_main_llm' | 'after_main_llm';
		opId: string;
		userEntryId: string;
		userMainPartId: string;
		beforeText: string;
		afterText: string;
		committedAt: string;
	}>;
};

export type LatestWorldInfoActivationsResponse = {
	generationId: string | null;
	startedAt: string | null;
	status: 'streaming' | 'done' | 'aborted' | 'error' | null;
	activatedCount: number;
	warnings: string[];
	entries: Array<{
		hash: string;
		bookId: string;
		bookName: string;
		uid: number;
		comment: string;
		content: string;
		matchedKeys: string[];
		reasons: string[];
	}>;
};

export async function listChatEntries(params: {
	chatId: string;
	branchId?: string;
	limit?: number;
	before?: number;
}): Promise<{ branchId: string; currentTurn: number; entries: ChatEntryWithVariantDto[] }> {
	const qs = new URLSearchParams();
	if (params.branchId) qs.set('branchId', params.branchId);
	if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
	if (typeof params.before === 'number') qs.set('before', String(params.before));
	return apiJson<{ branchId: string; currentTurn: number; entries: ChatEntryWithVariantDto[] }>(
		`/chats/${encodeURIComponent(params.chatId)}/entries?${qs.toString()}`,
	);
}

async function* streamSseRequest(params: {
	path: string;
	body: Record<string, unknown>;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const res = await fetch(`${BASE_URL}${params.path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream',
			Connection: 'keep-alive',
			'Cache-Control': 'no-cache',
		},
		body: JSON.stringify(params.body),
		signal: params.signal,
	});

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
		throw new Error(body?.error?.message ?? `HTTP error ${res.status}`);
	}

	const reader = res.body?.getReader();
	if (!reader) throw new Error('SSE: response body is not readable');

	const decoder = new TextDecoder();
	let buffer = '';
	let currentEventType: string | null = null;

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const rawLine of lines) {
			const line = rawLine.trimEnd();
			if (!line) {
				currentEventType = null;
				continue;
			}
			if (line.startsWith(':')) continue;
			if (line.startsWith('event:')) {
				currentEventType = line.slice('event:'.length).trim();
				continue;
			}
			if (line.startsWith('data:')) {
				const payload = line.slice('data:'.length).trim();
				if (!payload) continue;
				try {
					const env = JSON.parse(payload) as SseEnvelope;
					if (!env.type && currentEventType) env.type = currentEventType;
					yield env;
				} catch {
					// ignore malformed chunks
				}
			}
		}
	}
}

export async function* streamChatEntry(params: {
	chatId: string;
	branchId?: string;
	role: 'user' | 'system';
	content: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();
	yield* streamSseRequest({
		path: `/chats/${encodeURIComponent(params.chatId)}/entries`,
		body: {
			ownerId: params.ownerId,
			branchId: params.branchId,
			role: params.role,
			content: params.content,
			settings: withChatGenerationDebugSettings(params.settings),
			requestId,
		},
		signal: params.signal,
	});
}

export async function* streamRegenerateEntry(params: {
	entryId: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();
	yield* streamSseRequest({
		path: `/entries/${encodeURIComponent(params.entryId)}/regenerate`,
		body: {
			ownerId: params.ownerId,
			settings: withChatGenerationDebugSettings(params.settings),
			requestId,
		},
		signal: params.signal,
	});
}

export async function* streamContinueEntry(params: {
	chatId: string;
	branchId?: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();
	yield* streamSseRequest({
		path: `/chats/${encodeURIComponent(params.chatId)}/entries/continue`,
		body: {
			ownerId: params.ownerId,
			branchId: params.branchId,
			settings: withChatGenerationDebugSettings(params.settings),
			requestId,
		},
		signal: params.signal,
	});
}

export async function listEntryVariants(entryId: string): Promise<Variant[]> {
	return apiJson<Variant[]>(`/entries/${encodeURIComponent(entryId)}/variants`);
}

export async function selectEntryVariant(params: { entryId: string; variantId: string }): Promise<{ entryId: string; activeVariantId: string }> {
	return apiJson<{ entryId: string; activeVariantId: string }>(
		`/entries/${encodeURIComponent(params.entryId)}/variants/${encodeURIComponent(params.variantId)}/select`,
		{ method: 'POST' },
	);
}

export async function deleteEntryVariant(params: { entryId: string; variantId: string }): Promise<{ entryId: string; activeVariantId: string; deletedVariantId: string }> {
	return apiJson<{ entryId: string; activeVariantId: string; deletedVariantId: string }>(
		`/entries/${encodeURIComponent(params.entryId)}/variants/${encodeURIComponent(params.variantId)}/soft-delete`,
		{ method: 'POST' },
	);
}

export async function manualEditEntry(params: {
	entryId: string;
	partId?: string;
	content: string;
	ownerId?: string;
	requestId?: string;
}): Promise<{ entryId: string; activeVariantId: string }> {
	return apiJson<{ entryId: string; activeVariantId: string }>(
		`/entries/${encodeURIComponent(params.entryId)}/manual-edit`,
		{
			method: 'POST',
			body: JSON.stringify({
				ownerId: params.ownerId,
				partId: params.partId,
				content: params.content,
				requestId: params.requestId,
			}),
		},
	);
}

export async function softDeleteEntry(entryId: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/entries/${encodeURIComponent(entryId)}/soft-delete`, {
		method: 'POST',
		body: JSON.stringify({ by: 'user' }),
	});
}

export async function softDeleteEntriesBulk(entryIds: string[]): Promise<{ ids: string[] }> {
	return apiJson<{ ids: string[] }>(`/entries/soft-delete-bulk`, {
		method: 'POST',
		body: JSON.stringify({ entryIds, by: 'user' }),
	});
}

export async function softDeletePart(partId: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/parts/${encodeURIComponent(partId)}/soft-delete`, {
		method: 'POST',
		body: JSON.stringify({ by: 'user' }),
	});
}

export async function setEntryPromptVisibility(params: {
	entryId: string;
	includeInPrompt: boolean;
}): Promise<{ id: string; includeInPrompt: boolean }> {
	return apiJson<{ id: string; includeInPrompt: boolean }>(
		`/entries/${encodeURIComponent(params.entryId)}/prompt-visibility`,
		{
			method: 'POST',
			body: JSON.stringify({ includeInPrompt: params.includeInPrompt }),
		},
	);
}

export async function getEntryPromptDiagnostics(params: {
	entryId: string;
	variantId?: string;
}): Promise<PromptDiagnosticsResponse> {
	const qs = new URLSearchParams();
	if (params.variantId) qs.set('variantId', params.variantId);
	return apiJson<PromptDiagnosticsResponse>(
		`/entries/${encodeURIComponent(params.entryId)}/prompt-diagnostics${qs.toString() ? `?${qs.toString()}` : ''}`,
	);
}

export async function getLatestWorldInfoActivations(params: {
	chatId: string;
	branchId?: string;
}): Promise<LatestWorldInfoActivationsResponse> {
	const qs = new URLSearchParams();
	if (params.branchId) qs.set('branchId', params.branchId);
	return apiJson<LatestWorldInfoActivationsResponse>(
		`/chats/${encodeURIComponent(params.chatId)}/world-info/latest-activations${qs.toString() ? `?${qs.toString()}` : ''}`,
	);
}

