import { AgentCard, InteractionBranch } from '@shared/types/agent-card';
import { v4 as uuidv4 } from 'uuid';

export const createNewAgentCard = (params?: { title?: string; systemPrompt?: string }): AgentCard => {
	const now = new Date().toISOString();

	// Создаем основную ветку по умолчанию
	const initialBranch: InteractionBranch = {
		id: uuidv4(),
		createdAt: now,
		messages: [],
	};

	// Создаем базовый объект карточки
	const newCard: AgentCard = {
		id: uuidv4(),
		title: params?.title || 'New Chat',
		createdAt: now,
		updatedAt: now,
		introSwipes: {
			id: uuidv4(),
			type: 'default',
			swipes: [],
			role: 'assistant',
			timestamp: now,
		},
		interactionBranches: [initialBranch],
		activeBranchId: initialBranch.id,
		systemPrompt: params?.systemPrompt,
		metadata: {},
	};

	return newCard;
};
