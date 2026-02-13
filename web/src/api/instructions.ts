import { apiJson } from './api-json';

export type InstructionDto = {
	id: string;
	ownerId: string;
	name: string;
	engine: 'liquidjs';
	templateText: string;
	meta: unknown | null;
	createdAt: string;
	updatedAt: string;
};

export async function listInstructions(params?: { ownerId?: string }): Promise<InstructionDto[]> {
	const query = new URLSearchParams();
	if (typeof params?.ownerId === 'string') query.set('ownerId', params.ownerId);
	const suffix = query.size > 0 ? `?${query.toString()}` : '';
	return apiJson<InstructionDto[]>(`/instructions${suffix}`);
}

export async function createInstruction(params: {
	name: string;
	engine?: 'liquidjs';
	templateText: string;
	meta?: unknown;
	ownerId?: string;
}): Promise<InstructionDto> {
	return apiJson<InstructionDto>('/instructions', {
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

export async function updateInstruction(params: {
	id: string;
	name?: string;
	engine?: 'liquidjs';
	templateText?: string;
	meta?: unknown;
}): Promise<InstructionDto> {
	return apiJson<InstructionDto>(`/instructions/${encodeURIComponent(params.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			name: params.name,
			engine: params.engine,
			templateText: params.templateText,
			meta: params.meta,
		}),
	});
}

export async function deleteInstruction(id: string): Promise<{ id: string }> {
	return apiJson<{ id: string }>(`/instructions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function prerenderInstruction(params: {
	templateText: string;
	ownerId?: string;
	chatId?: string;
	branchId?: string;
	entityProfileId?: string;
	historyLimit?: number;
}): Promise<{ rendered: string }> {
	return apiJson<{ rendered: string }>('/instructions/prerender', {
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

