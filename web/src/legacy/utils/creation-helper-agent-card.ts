import {
	type AgentCard,
	type InteractionBranch,
	type InteractionMessage,
	type Swipe,
	type SwipeComponent,
	type SwipeComponentType,
} from '@shared/types/agent-card';
import { v4 as uuidv4 } from 'uuid';

export const createNewAgentCard = (params?: { title?: string; systemPrompt?: string }): AgentCard => {
	const now = new Date().toISOString();

	const initialBranch: InteractionBranch = {
		id: uuidv4(),
		createdAt: now,
		isStarted: false,
		messages: [],
	};

	const newCard: AgentCard = {
		id: uuidv4(),
		name: params?.title || 'New Chat',
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

export const createNewSwipe = (params: { content: string }) => {
	const { content } = params;

	const now = new Date().toISOString();
	const swipeId = uuidv4();
	const contentId = uuidv4();

	const swipe = {
		id: swipeId,
		components: [
			{
				id: contentId,
				type: 'answer',
				content: content,
			},
		],
		timestamp: now,
	} as Swipe;

	return { swipe, swipeId, contentId };
};

export const createNewSwipeComponent = (params: { content: string; type: SwipeComponentType }) => {
	const { content, type } = params;

	const contentId = uuidv4();

	return {
		content: {
			id: contentId,
			type,
			content: content,
		} as SwipeComponent,
		contentId,
	};
};

