import { type AgentCard, type InteractionMessage, type SwipeComponentType } from '@shared/types/agent-card';

export const getActiveBranchId = (agentCard: AgentCard): string | null => {
	return agentCard.activeBranchId ?? agentCard.activeBranch?.branch.id ?? agentCard.interactionBranches[0]?.id ?? null;
};

export const getLastMessageId = (agentCard: AgentCard, branchId: string): string | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === branchId);
	if (!branch || branch.messages.length === 0) return null;

	const sortedMessages = [...branch.messages].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	return sortedMessages[0].id;
};

export const getLastSwipeId = (agentCard: AgentCard, branchId: string, messageId: string): string | null => {
	const branch = agentCard.interactionBranches.find((b) => b.id === branchId);
	const message = branch?.messages.find((m) => m.id === messageId);

	if (!message || message.swipes.length === 0) return null;

	const sortedSwipes = [...message.swipes].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	return sortedSwipes[0].id;
};

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

	const targetComponent = componentType
		? swipe.components.find((c) => c.type === componentType)
		: swipe.components[swipe.components.length - 1];

	return targetComponent?.id ?? null;
};

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

	const content = lastSwipe.components.find((c) => c.type === 'answer');
	if (!content?.id) return null;
	const contentId = content.id;

	return { messageId, swipeId, contentId, message: lastMessage };
};

