import { apiJson } from './api-json';

export type PromptTemplateDto = {
	id: string;
	ownerId: string;
	name: string;
	engine: 'liquidjs';
	templateText: string;
	meta: unknown | null;
	createdAt: string;
	updatedAt: string;
};

export async function listPromptTemplates(params?: { ownerId?: string }): Promise<PromptTemplateDto[]> {
	const query = new URLSearchParams();
	if (typeof params?.ownerId === 'string') query.set('ownerId', params.ownerId);
	const suffix = query.size > 0 ? `?${query.toString()}` : '';
	return apiJson<PromptTemplateDto[]>(`/prompt-templates${suffix}`);
}

export async function createPromptTemplate(params: {
	name: string;
	engine?: 'liquidjs';
	templateText: string;
	meta?: unknown;
	ownerId?: string;
}): Promise<PromptTemplateDto> {
	return apiJson<PromptTemplateDto>('/prompt-templates', {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			name: params.name,
			engine: params.engine ?? 'liquidjs',
			templateText: params.templateText,
			meta: params.meta,
		}),
	});
}

export async function updatePromptTemplate(params: {
	id: string;
	name?: string;
	engine?: 'liquidjs';
	templateText?: string;
	meta?: unknown;
}): Promise<PromptTemplateDto> {
	return apiJson<PromptTemplateDto>(`/prompt-templates/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			name: params.name,
			engine: params.engine,
			templateText: params.templateText,
			meta: params.meta,
		}),
	});
}

export async function deletePromptTemplate(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/prompt-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function prerenderPromptTemplate(params: {
	templateText: string;
	ownerId?: string;
	chatId?: string;
	branchId?: string;
	entityProfileId?: string;
	historyLimit?: number;
}): Promise<{ rendered: string }> {
	return apiJson<{ rendered: string }>('/prompt-templates/prerender', {
		method: 'POST',
		body: JSON.stringify({
			ownerId: params.ownerId,
			templateText: params.templateText,
			chatId: params.chatId,
			branchId: params.branchId,
			entityProfileId: params.entityProfileId,
			historyLimit: params.historyLimit,
		}),
	});
}

