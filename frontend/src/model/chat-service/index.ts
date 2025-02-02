import { createStore, createEvent } from 'effector';
import { AgentCard } from '@shared/types/agent-card';

export const $currentAgentCard = createStore<AgentCard | null>(null);
export const setCurrentAgentCard = createEvent<AgentCard>();

$currentAgentCard.on(setCurrentAgentCard, (_, card) => card);

export const $currentChat = $currentAgentCard.map((card) => {
	if (!card) return null;

	const activeBranch =
		card.interactionBranches.find((branch) => branch.id === card.activeBranchId) || card.interactionBranches[0];
	if (!activeBranch) return null;

	let messages = activeBranch.messages;

	return messages;
});
