import { apiJson } from './api-json';

export type PromptTemplateScope = 'global' | 'entity_profile' | 'chat';

export type PromptTemplateDto = {
	id: string;
	ownerId: string;
	name: string;
	enabled: boolean;
	scope: PromptTemplateScope;
	scopeId: string | null;
	engine: 'liquidjs';
	templateText: string;
	meta: unknown | null;
	createdAt: string;
	updatedAt: string;
};

export async function listPromptTemplates(params: {
	scope: PromptTemplateScope;
	scopeId?: string;
}): Promise<PromptTemplateDto[]> {
	const query = new URLSearchParams();
	query.set('scope', params.scope);
	if (typeof params.scopeId === 'string') query.set('scopeId', params.scopeId);
	return apiJson<PromptTemplateDto[]>(`/prompt-templates?${query.toString()}`);
}

export async function createPromptTemplate(params: {
	name: string;
	enabled?: boolean;
	scope: PromptTemplateScope;
	scopeId?: string;
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
			enabled: params.enabled ?? true,
			scope: params.scope,
			scopeId: params.scope === 'global' ? undefined : params.scopeId,
			engine: params.engine ?? 'liquidjs',
			templateText: params.templateText,
			meta: params.meta,
		}),
	});
}

export async function updatePromptTemplate(params: {
	id: string;
	name?: string;
	enabled?: boolean;
	scope?: PromptTemplateScope;
	scopeId?: string | null;
	engine?: 'liquidjs';
	templateText?: string;
	meta?: unknown;
}): Promise<PromptTemplateDto> {
	return apiJson<PromptTemplateDto>(`/prompt-templates/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			name: params.name,
			enabled: params.enabled,
			scope: params.scope,
			scopeId: typeof params.scopeId === 'undefined' ? undefined : params.scopeId,
			engine: params.engine,
			templateText: params.templateText,
			meta: params.meta,
		}),
	});
}

export async function deletePromptTemplate(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/prompt-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

