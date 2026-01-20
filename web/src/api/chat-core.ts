import { BASE_URL } from '../const';

type ApiEnvelope<T> = { data: T; error?: unknown };

export const BACKEND_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

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

export type EntityProfileDto = {
	id: string;
	ownerId: string;
	name: string;
	kind: 'CharSpec';
	spec: unknown;
	meta: unknown | null;
	avatarAssetId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ChatDto = {
	id: string;
	ownerId: string;
	entityProfileId: string;
	title: string;
	activeBranchId: string | null;
	status: 'active' | 'archived' | 'deleted';
	createdAt: string;
	updatedAt: string;
	lastMessageAt: string | null;
	lastMessagePreview: string | null;
	version: number;
	meta: unknown | null;
};

export type ChatBranchDto = {
	id: string;
	ownerId: string;
	chatId: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
	parentBranchId: string | null;
	forkedFromMessageId: string | null;
	forkedFromVariantId: string | null;
	meta: unknown | null;
};

export type ChatMessageDto = {
	id: string;
	ownerId: string;
	chatId: string;
	branchId: string;
	role: 'user' | 'assistant' | 'system';
	createdAt: string;
	promptText: string;
	format: string | null;
	blocks: unknown[];
	meta: unknown | null;
	activeVariantId: string | null;
};

export type ListChatMessagesResponse = {
	branchId: string;
	messages: ChatMessageDto[];
};

export type CreateChatResponse = { chat: ChatDto; mainBranch: ChatBranchDto };

export async function listEntityProfiles(): Promise<EntityProfileDto[]> {
	return apiJson<EntityProfileDto[]>('/entity-profiles');
}

export async function createEntityProfile(params: {
	name: string;
	spec: unknown;
	meta?: unknown;
	ownerId?: string;
	avatarAssetId?: string;
}): Promise<EntityProfileDto> {
	return apiJson<EntityProfileDto>('/entity-profiles', {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			name: params.name,
			kind: 'CharSpec',
			spec: params.spec,
			meta: params.meta,
			avatarAssetId: params.avatarAssetId,
		}),
	});
}

export type ImportEntityProfilesResponse = {
	created: EntityProfileDto[];
	failed: Array<{ originalName: string; error: string }>;
	message: string;
};

export async function importEntityProfiles(files: File[]): Promise<ImportEntityProfilesResponse> {
	const form = new FormData();
	files.forEach((f) => form.append('files', f));
	return apiForm<ImportEntityProfilesResponse>('/entity-profiles/import', form, { method: 'POST' });
}

export async function deleteEntityProfile(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/entity-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listChatsForEntityProfile(entityProfileId: string): Promise<ChatDto[]> {
	return apiJson<ChatDto[]>(`/entity-profiles/${encodeURIComponent(entityProfileId)}/chats`);
}

export async function createChatForEntityProfile(params: {
	entityProfileId: string;
	title?: string;
	meta?: unknown;
	ownerId?: string;
}): Promise<CreateChatResponse> {
	return apiJson<CreateChatResponse>(`/entity-profiles/${encodeURIComponent(params.entityProfileId)}/chats`, {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			title: params.title ?? 'New chat',
			meta: params.meta,
		}),
	});
}

export async function deleteChat(chatId: string): Promise<ChatDto> {
	return apiJson<ChatDto>(`/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
}

export async function getChatById(chatId: string): Promise<ChatDto> {
	return apiJson<ChatDto>(`/chats/${encodeURIComponent(chatId)}`);
}

export async function listChatBranches(chatId: string): Promise<ChatBranchDto[]> {
	return apiJson<ChatBranchDto[]>(`/chats/${encodeURIComponent(chatId)}/branches`);
}

export async function createChatBranch(params: {
	chatId: string;
	title?: string;
	parentBranchId?: string;
	forkedFromMessageId?: string;
	forkedFromVariantId?: string;
	meta?: unknown;
	ownerId?: string;
}): Promise<ChatBranchDto> {
	return apiJson<ChatBranchDto>(`/chats/${encodeURIComponent(params.chatId)}/branches`, {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			title: params.title,
			parentBranchId: params.parentBranchId,
			forkedFromMessageId: params.forkedFromMessageId,
			forkedFromVariantId: params.forkedFromVariantId,
			meta: params.meta,
		}),
	});
}

export async function activateChatBranch(params: { chatId: string; branchId: string }): Promise<ChatDto> {
	return apiJson<ChatDto>(
		`/chats/${encodeURIComponent(params.chatId)}/branches/${encodeURIComponent(params.branchId)}/activate`,
		{ method: 'POST' },
	);
}

export async function listChatMessages(params: {
	chatId: string;
	branchId?: string;
	limit?: number;
	before?: number;
}): Promise<ListChatMessagesResponse> {
	const query = new URLSearchParams();
	if (params.branchId) query.set('branchId', params.branchId);
	if (typeof params.limit === 'number') query.set('limit', String(params.limit));
	if (typeof params.before === 'number') query.set('before', String(params.before));

	const suffix = query.toString() ? `?${query.toString()}` : '';
	return apiJson<ListChatMessagesResponse>(`/chats/${encodeURIComponent(params.chatId)}/messages${suffix}`);
}

export type SseEnvelope<T = unknown> = {
	id: string;
	type: string;
	ts: number;
	data: T;
};

export type ChatStreamMeta = {
	chatId: string;
	branchId: string;
	userMessageId?: string | null;
	assistantMessageId: string;
	variantId: string;
	generationId: string;
	pipelineRunId: string | null;
	pipelineStepRunId: string | null;
};

export type ChatStreamDelta = { content: string };
export type ChatStreamError = { message: string };
export type ChatStreamDone = { status: 'done' | 'aborted' | 'error' };

function makeRequestId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function* streamChatMessage(params: {
	chatId: string;
	branchId?: string;
	role: 'user' | 'system';
	promptText: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();

	const res = await fetch(`${BASE_URL}/chats/${encodeURIComponent(params.chatId)}/messages`, {
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
			promptText: params.promptText,
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
			// Heartbeats are comments: ": ping 123"
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
					// Some clients rely on event:; backend duplicates it in env.type.
					if (!env.type && currentEventType) env.type = currentEventType;
					yield env;
				} catch {
					// Ignore malformed chunks; stream should keep going.
				}
			}
		}
	}
}

export async function abortGeneration(generationId: string): Promise<void> {
	await apiJson<{ success: true }>(`/generations/${encodeURIComponent(generationId)}/abort`, { method: 'POST' });
}

export type MessageVariantDto = {
	id: string;
	ownerId: string;
	messageId: string;
	createdAt: string;
	kind: 'generation' | 'manual_edit' | 'import';
	promptText: string;
	blocks: unknown[];
	meta: unknown | null;
	isSelected: boolean;
};

export async function createManualEditVariant(params: {
	messageId: string;
	promptText: string;
	blocks?: unknown[];
	meta?: unknown;
	ownerId?: string;
}): Promise<MessageVariantDto> {
	return apiJson<MessageVariantDto>(`/messages/${encodeURIComponent(params.messageId)}/variants`, {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			promptText: params.promptText,
			blocks: params.blocks,
			meta: params.meta,
		}),
	});
}

export async function deleteChatMessage(messageId: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
}

export async function listMessageVariants(messageId: string): Promise<MessageVariantDto[]> {
	return apiJson<MessageVariantDto[]>(`/messages/${encodeURIComponent(messageId)}/variants`);
}

export async function selectMessageVariant(params: {
	messageId: string;
	variantId: string;
}): Promise<MessageVariantDto> {
	return apiJson<MessageVariantDto>(
		`/messages/${encodeURIComponent(params.messageId)}/variants/${encodeURIComponent(params.variantId)}/select`,
		{ method: 'POST' },
	);
}

export async function* streamRegenerateMessageVariant(params: {
	messageId: string;
	settings?: Record<string, unknown>;
	ownerId?: string;
	signal?: AbortSignal;
}): AsyncGenerator<SseEnvelope> {
	const requestId = makeRequestId();

	const res = await fetch(`${BASE_URL}/messages/${encodeURIComponent(params.messageId)}/regenerate`, {
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
			// Heartbeats are comments: ": ping 123"
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
					// Some clients rely on event:; backend duplicates it in env.type.
					if (!env.type && currentEventType) env.type = currentEventType;
					yield env;
				} catch {
					// Ignore malformed chunks; stream should keep going.
				}
			}
		}
	}
}

// ---- Pipeline profiles + debug (Phase 2/3 minimal UI)

export type PipelineProfileDto = {
	id: string;
	ownerId: string;
	name: string;
	version: number;
	spec: unknown;
	meta: unknown | null;
	createdAt: string;
	updatedAt: string;
};

export type ResolvedActivePipelineProfile = {
	profile: PipelineProfileDto | null;
	source: 'chat' | 'entity_profile' | 'global' | 'none';
	profileId: string | null;
	profileVersion: number | null;
};

export type ChatActivePipelineProfileResponse = {
	chatId: string;
	entityProfileId: string;
	resolved: ResolvedActivePipelineProfile;
	bindings: {
		chat: { profileId: string } | null;
		entityProfile: { profileId: string } | null;
		global: { profileId: string } | null;
	};
};

export async function listPipelineProfiles(): Promise<PipelineProfileDto[]> {
	return apiJson<PipelineProfileDto[]>('/pipeline-profiles');
}

export async function createPipelineProfile(params: {
	name: string;
	spec: unknown;
	meta?: unknown;
	ownerId?: string;
}): Promise<PipelineProfileDto> {
	return apiJson<PipelineProfileDto>('/pipeline-profiles', {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			name: params.name,
			spec: params.spec,
			meta: params.meta,
		}),
	});
}

export async function updatePipelineProfile(params: {
	id: string;
	name?: string;
	spec?: unknown;
	meta?: unknown;
}): Promise<PipelineProfileDto> {
	return apiJson<PipelineProfileDto>(`/pipeline-profiles/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			name: params.name,
			spec: params.spec,
			meta: params.meta,
		}),
	});
}

export async function deletePipelineProfile(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/pipeline-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getChatActivePipelineProfile(chatId: string): Promise<ChatActivePipelineProfileResponse> {
	return apiJson<ChatActivePipelineProfileResponse>(`/chats/${encodeURIComponent(chatId)}/active-pipeline-profile`);
}

export async function setChatActivePipelineProfile(params: {
	chatId: string;
	profileId: string | null;
	ownerId?: string;
}): Promise<{ chatId: string; entityProfileId: string; resolved: ResolvedActivePipelineProfile }> {
	return apiJson<{ chatId: string; entityProfileId: string; resolved: ResolvedActivePipelineProfile }>(
		`/chats/${encodeURIComponent(params.chatId)}/active-pipeline-profile`,
		{
			method: 'PUT',
			body: JSON.stringify({ ownerId: params.ownerId, profileId: params.profileId }),
		},
	);
}

export async function setEntityProfileActivePipelineProfile(params: {
	entityProfileId: string;
	profileId: string | null;
	ownerId?: string;
}): Promise<{ entityProfileId: string; profileId: string | null }> {
	return apiJson<{ entityProfileId: string; profileId: string | null }>(
		`/entity-profiles/${encodeURIComponent(params.entityProfileId)}/active-pipeline-profile`,
		{
			method: 'PUT',
			body: JSON.stringify({ ownerId: params.ownerId, profileId: params.profileId }),
		},
	);
}

export async function setGlobalActivePipelineProfile(params: {
	profileId: string | null;
	ownerId?: string;
}): Promise<{ ownerId: string; global: { profileId: string } | null }> {
	return apiJson<{ ownerId: string; global: { profileId: string } | null }>(`/active-pipeline-profile`, {
		method: 'PUT',
		body: JSON.stringify({ ownerId: params.ownerId, profileId: params.profileId }),
	});
}

export type ChatPipelineDebugDto = {
	chatId: string;
	branchId: string | null;
	resolvedActiveProfile: ResolvedActivePipelineProfile;
	run: unknown | null;
	steps: unknown[];
	generation: unknown | null;
};

export async function getChatPipelineDebug(params: {
	chatId: string;
	branchId?: string;
}): Promise<ChatPipelineDebugDto> {
	const query = new URLSearchParams();
	if (params.branchId) query.set('branchId', params.branchId);
	const suffix = query.toString() ? `?${query.toString()}` : '';
	return apiJson<ChatPipelineDebugDto>(`/chats/${encodeURIComponent(params.chatId)}/pipeline-debug${suffix}`);
}

export type PipelineStateRunDto = {
	id: string;
	trigger: string;
	status: string;
	startedAt: string;
	finishedAt: string | null;
	branchId: string | null;
	userMessageId: string | null;
	assistantMessageId: string | null;
	assistantVariantId: string | null;
	generationId: string | null;
};

export type PipelineStateStepDto = {
	id: string;
	runId: string;
	stepName: string;
	stepType: string;
	status: string;
	startedAt: string;
	finishedAt: string | null;
	error: string | null;
};

export type PipelineStateGenerationDto = {
	id: string;
	status: string;
	startedAt: string;
	finishedAt: string | null;
	branchId: string | null;
	messageId: string;
	variantId: string | null;
	pipelineRunId: string | null;
	pipelineStepRunId: string | null;
	error: string | null;
};

export type ChatPipelineStateDto = {
	chatId: string;
	run: PipelineStateRunDto | null;
	step: PipelineStateStepDto | null;
	generation: PipelineStateGenerationDto | null;
};

export async function getChatPipelineState(params: {
	chatId: string;
	branchId?: string;
}): Promise<ChatPipelineStateDto> {
	const query = new URLSearchParams();
	if (params.branchId) query.set('branchId', params.branchId);
	const suffix = query.toString() ? `?${query.toString()}` : '';
	return apiJson<ChatPipelineStateDto>(`/chats/${encodeURIComponent(params.chatId)}/pipeline-state${suffix}`);
}
