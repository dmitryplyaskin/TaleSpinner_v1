import { BASE_URL } from '../const';

import type {
	OperationProfile,
	OperationProfileExport,
	OperationProfileSettings,
	OperationProfileUpsertInput,
} from '@shared/types/operation-profiles';

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
	isFavorite: boolean;
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
	promptTemplateId: string | null;
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

export type CreateChatResponse = { chat: ChatDto; mainBranch: ChatBranchDto };

export async function listEntityProfiles(): Promise<EntityProfileDto[]> {
	return apiJson<EntityProfileDto[]>('/entity-profiles');
}

export async function createEntityProfile(params: {
	name: string;
	spec: unknown;
	meta?: unknown;
	ownerId?: string;
	isFavorite?: boolean;
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
			isFavorite: params.isFavorite,
			avatarAssetId: params.avatarAssetId,
		}),
	});
}

export async function updateEntityProfile(params: {
	id: string;
	name?: string;
	kind?: 'CharSpec';
	spec?: unknown;
	meta?: unknown;
	isFavorite?: boolean;
	avatarAssetId?: string | null;
}): Promise<EntityProfileDto> {
	return apiJson<EntityProfileDto>(`/entity-profiles/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			name: params.name,
			kind: params.kind,
			spec: params.spec,
			meta: params.meta,
			isFavorite: params.isFavorite,
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

export async function exportEntityProfileFile(params: {
	id: string;
	format: 'json' | 'png';
	preferredName?: string;
}): Promise<{ blob: Blob; filename: string; contentType: string }> {
	const res = await fetch(
		`${BASE_URL}/entity-profiles/${encodeURIComponent(params.id)}/export?format=${encodeURIComponent(params.format)}`,
		{
			method: 'GET',
		},
	);
	if (!res.ok) {
		let message = `HTTP error ${res.status}`;
		try {
			const body = (await res.json()) as { error?: { message?: string } };
			message = body?.error?.message ?? message;
		} catch {
			// ignore parse error
		}
		throw new Error(message);
	}

	const blob = await res.blob();
	const contentType = res.headers.get('content-type') ?? blob.type ?? 'application/octet-stream';
	const disposition = res.headers.get('content-disposition') ?? '';
	const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
	let fromHeader: string | undefined;
	if (utf8Match?.[1]) {
		try {
			fromHeader = decodeURIComponent(utf8Match[1]);
		} catch {
			fromHeader = utf8Match[1];
		}
	} else {
		fromHeader = plainMatch?.[1];
	}
	const safePreferredName = (params.preferredName ?? 'entity_profile').replace(/[\\/:*?"<>|]+/g, '_').trim();
	const defaultFilename = `${safePreferredName.length > 0 ? safePreferredName : 'entity_profile'}.${params.format}`;
	const safeHeaderFilename = (fromHeader ?? '').replace(/[\\/:*?"<>|]+/g, '_').trim();
	return {
		blob,
		filename: safeHeaderFilename.length > 0 ? safeHeaderFilename : defaultFilename,
		contentType,
	};
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

export async function updateChat(params: { chatId: string; title: string }): Promise<ChatDto> {
	return apiJson<ChatDto>(`/chats/${encodeURIComponent(params.chatId)}`, {
		method: 'PUT',
		body: JSON.stringify({ title: params.title }),
	});
}

export async function getChatById(chatId: string): Promise<ChatDto> {
	return apiJson<ChatDto>(`/chats/${encodeURIComponent(chatId)}`);
}

export async function setChatPromptTemplate(params: {
	chatId: string;
	promptTemplateId: string | null;
}): Promise<ChatDto> {
	return apiJson<ChatDto>(`/chats/${encodeURIComponent(params.chatId)}/prompt-template`, {
		method: 'PUT',
		body: JSON.stringify({ promptTemplateId: params.promptTemplateId }),
	});
}

export async function listChatBranches(chatId: string): Promise<ChatBranchDto[]> {
	return apiJson<ChatBranchDto[]>(`/chats/${encodeURIComponent(chatId)}/branches`);
}

export async function createChatBranch(params: {
	chatId: string;
	title?: string;
	parentBranchId?: string;
	meta?: unknown;
	ownerId?: string;
}): Promise<ChatBranchDto> {
	return apiJson<ChatBranchDto>(`/chats/${encodeURIComponent(params.chatId)}/branches`, {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			title: params.title,
			parentBranchId: params.parentBranchId,
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

export async function updateChatBranch(params: { chatId: string; branchId: string; title: string }): Promise<ChatBranchDto> {
	return apiJson<ChatBranchDto>(
		`/chats/${encodeURIComponent(params.chatId)}/branches/${encodeURIComponent(params.branchId)}`,
		{
			method: 'PUT',
			body: JSON.stringify({ title: params.title }),
		},
	);
}

export async function deleteChatBranch(params: { chatId: string; branchId: string }): Promise<{ chat: ChatDto; deletedBranchId: string }> {
	return apiJson<{ chat: ChatDto; deletedBranchId: string }>(
		`/chats/${encodeURIComponent(params.chatId)}/branches/${encodeURIComponent(params.branchId)}`,
		{ method: 'DELETE' },
	);
}

export type SseEnvelope<T = unknown> = {
	id: string;
	type: string;
	ts: number;
	data: T;
};

export async function abortGeneration(generationId: string): Promise<void> {
	await apiJson<{ success: true }>(`/generations/${encodeURIComponent(generationId)}/abort`, { method: 'POST' });
}

export type OperationProfileDto = Omit<OperationProfile, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

export type OperationProfileSettingsDto = Omit<OperationProfileSettings, 'updatedAt'> & {
	updatedAt: string;
};

export async function listOperationProfiles(): Promise<OperationProfileDto[]> {
	return apiJson<OperationProfileDto[]>('/operation-profiles');
}

export async function createOperationProfile(params: {
	ownerId?: string;
	input: OperationProfileUpsertInput;
}): Promise<OperationProfileDto> {
	return apiJson<OperationProfileDto>('/operation-profiles', {
		method: 'POST',
		body: JSON.stringify({ ownerId: params.ownerId, input: params.input }),
	});
}

export async function updateOperationProfile(params: {
	ownerId?: string;
	profileId: string;
	patch: Partial<OperationProfileUpsertInput>;
}): Promise<OperationProfileDto> {
	return apiJson<OperationProfileDto>(`/operation-profiles/${encodeURIComponent(params.profileId)}`, {
		method: 'PUT',
		body: JSON.stringify({ ownerId: params.ownerId, patch: params.patch }),
	});
}

export async function deleteOperationProfile(profileId: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/operation-profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' });
}

export async function exportOperationProfile(profileId: string): Promise<OperationProfileExport> {
	return apiJson<OperationProfileExport>(`/operation-profiles/${encodeURIComponent(profileId)}/export`);
}

export async function importOperationProfiles(params: {
	ownerId?: string;
	items: OperationProfileExport | OperationProfileExport[];
}): Promise<{ created: OperationProfileDto[] }> {
	return apiJson<{ created: OperationProfileDto[] }>('/operation-profiles/import', {
		method: 'POST',
		body: JSON.stringify({ ownerId: params.ownerId, items: params.items }),
	});
}

export async function getActiveOperationProfile(): Promise<OperationProfileSettingsDto> {
	return apiJson<OperationProfileSettingsDto>('/operation-profiles/active');
}

export async function setActiveOperationProfile(activeProfileId: string | null): Promise<OperationProfileSettingsDto> {
	return apiJson<OperationProfileSettingsDto>('/operation-profiles/active', {
		method: 'PUT',
		body: JSON.stringify({ activeProfileId }),
	});
}
