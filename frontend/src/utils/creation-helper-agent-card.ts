import { AgentCard, InteractionBranch, InteractionMessage } from '@shared/types/agent-card';
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
			activeSwipeId: '',
		},
		interactionBranches: [initialBranch],
		activeBranchId: initialBranch.id,
		systemPrompt: params?.systemPrompt,
		metadata: {},
	};

	return newCard;
};

export const createNewMessage = (params: { role: 'user' | 'assistant'; content: string }) => {
	const { role, content } = params;

	const now = new Date().toISOString();
	const messageId = uuidv4();
	const swipeId = uuidv4();
	const contentId = uuidv4();

	const message: InteractionMessage = {
		id: messageId,
		type: 'default',
		role: role,
		timestamp: now,
		activeSwipeId: swipeId,

		swipes: [
			{
				id: swipeId,
				components: [
					{
						id: contentId,
						type: 'answer',
						content: content,
					},
				],
				timestamp: now,
			},
		],
	};
	return {
		message,
		messageId,
		swipeId,
		contentId,
	};
};
