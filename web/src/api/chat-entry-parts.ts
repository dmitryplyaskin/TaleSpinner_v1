import { BASE_URL } from '../const';

import type { Variant, Entry } from '@shared/types/chat-entry-parts';
import type { SseEnvelope } from './chat-core';

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

function makeRequestId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ChatEntryWithVariantDto = {
	entry: Entry;
	variant: Variant | null;
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
	const res = await fetch(`${BASE_URL}/chats/${encodeURIComponent(params.chatId)}/entries`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream',
			Connection: 'keep-alive',
			'Cache-Control': 'no-cache',
		},
		body: JSON.stringify({
			ownerId: params.ownerId,
			branchId: params.branchId,
			role: params.role,
			content: params.content,
			settings: params.settings ?? {},
			requestId,
		}),
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

export async function* streamRegenerateEntry(params: {
	entryId: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();
	const res = await fetch(`${BASE_URL}/entries/${encodeURIComponent(params.entryId)}/regenerate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream',
			Connection: 'keep-alive',
			'Cache-Control': 'no-cache',
		},
		body: JSON.stringify({
			ownerId: params.ownerId,
			settings: params.settings ?? {},
			requestId,
		}),
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

export async function listEntryVariants(entryId: string): Promise<Variant[]> {
	return apiJson<Variant[]>(`/entries/${encodeURIComponent(entryId)}/variants`);
}

export async function selectEntryVariant(params: { entryId: string; variantId: string }): Promise<{ entryId: string; activeVariantId: string }> {
	return apiJson<{ entryId: string; activeVariantId: string }>(
		`/entries/${encodeURIComponent(params.entryId)}/variants/${encodeURIComponent(params.variantId)}/select`,
		{ method: 'POST' },
	);
}

export async function softDeletePart(partId: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/parts/${encodeURIComponent(partId)}/soft-delete`, {
		method: 'POST',
		body: JSON.stringify({ by: 'user' }),
	});
}

