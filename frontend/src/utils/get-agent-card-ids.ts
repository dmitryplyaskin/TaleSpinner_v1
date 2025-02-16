import { AgentCard, InteractionMessage, SwipeComponentType } from '@shared/types/agent-card';

// Получение ID активной ветки
export const getActiveBranchId = (agentCard: AgentCard): string | null => {
	return agentCard.activeBranchId ?? agentCard.activeBranch?.branch.id ?? agentCard.interactionBranches[0]?.id ?? null;
};

// Получение последнего message ID в ветке
export const getLastMessageId = (agentCard: AgentCard, branchId: string): string | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === branchId);
	if (!branch || branch.messages.length === 0) return null;

	// Сортируем сообщения по времени создания
	const sortedMessages = [...branch.messages].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	return sortedMessages[0].id;
};

// Получение последнего swipe ID в сообщении
export const getLastSwipeId = (agentCard: AgentCard, branchId: string, messageId: string): string | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === branchId);
	const message = branch?.messages.find((m) => m.id === messageId);

	if (!message || message.swipes.length === 0) return null;

	// Сортируем свайпы по времени
	const sortedSwipes = [...message.swipes].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	return sortedSwipes[0].id;
};

// Получение целевого component ID (по типу или последнего)
export const getTargetComponentId = (
	agentCard: AgentCard,
	branchId: string,
	messageId: string,
	swipeId: string,
	componentType?: SwipeComponentType,
): string | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === branchId);
	const message = branch?.messages.find((m) => m.id === messageId);
	const swipe = message?.swipes.find((s) => s.id === swipeId);

	if (!swipe || swipe.components.length === 0) return null;

	// Поиск по типу или последний компонент
	const targetComponent = componentType
		? swipe.components.find((c) => c.type === componentType)
		: swipe.components[swipe.components.length - 1];

	return targetComponent?.id ?? null;
};

// Композитный хелпер для получения всех ID
export const getAllRequiredIds = (
	agentCard: AgentCard,
	componentType?: SwipeComponentType,
): {
	branchId: string | null;
	messageId: string | null;
	swipeId: string | null;
	componentId: string | null;
} => {
	const branchId = getActiveBranchId(agentCard);
	if (!branchId) return { branchId: null, messageId: null, swipeId: null, componentId: null };

	const messageId = getLastMessageId(agentCard, branchId);
	if (!messageId) return { branchId, messageId: null, swipeId: null, componentId: null };

	const swipeId = getLastSwipeId(agentCard, branchId, messageId);
	if (!swipeId) return { branchId, messageId, swipeId: null, componentId: null };

	const componentId = getTargetComponentId(agentCard, branchId, messageId, swipeId, componentType);

	return { branchId, messageId, swipeId, componentId };
};

export const getLastMessageState = (
	agentCard: AgentCard,
): { messageId: string; swipeId: string; contentId: string; message: InteractionMessage } | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === agentCard.activeBranchId);
	if (!branch || branch.messages.length === 0) return null;

	const lastMessage = branch.messages[branch.messages.length - 1];
	if (!lastMessage) return null;

	const messageId = lastMessage.id;
	const lastSwipe = lastMessage.swipes[lastMessage.swipes.length - 1];
	const swipeId = lastSwipe.id;

	const contentId = lastSwipe.components.find((c) => c.type === 'answer')?.id!;

	return { messageId, swipeId, contentId, message: lastMessage };
};
