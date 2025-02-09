import { createStore, createEvent, createEffect, sample } from 'effector';
import { AgentCard, InteractionMessage } from '@shared/types/agent-card';
import { reducers } from './reducers';
import { controllers } from './controllers';
import { debounce } from 'patronum/debounce';
import { chatListModel } from '../chat-list';

export const $currentAgentCard = createStore<AgentCard | null>(null);
export const setCurrentAgentCard = createEvent<AgentCard>();

$currentAgentCard.on(setCurrentAgentCard, (_, card) => card);

export const $isAgentSelected = $currentAgentCard.map((agentCard) => !!agentCard);

export const $currentChat = $currentAgentCard.map((agentCard) => {
	if (!agentCard) return [];

	const activeBranch =
		agentCard.interactionBranches.find((branch) => branch.id === agentCard.activeBranchId) ||
		agentCard.interactionBranches[0];

	if (!activeBranch) return [];

	let messages = activeBranch.messages;

	return messages;
});

export const addNewUserMessage = createEvent<InteractionMessage>();
export const addNewAssistantMessage = createEvent<InteractionMessage>();

export const updateSwipeStream = createEvent<{
	messageId: string;
	swipeId: string;
	componentId: string;
	content: string;
}>();

export const updateSwipe = createEvent<{
	messageId: string;
	swipeId: string;
	componentId: string;
	content: string;
}>();

export const deleteMessage = createEvent<string>();
export const deleteSwipe = createEvent<{
	messageId: string;
	swipeId: string;
}>();

$currentAgentCard
	.on(addNewUserMessage, reducers.addNewUserMessage)
	.on(addNewAssistantMessage, reducers.addNewAssistantMessage)
	.on(updateSwipeStream, reducers.updateSwipeStream)
	.on(updateSwipe, reducers.updateSwipe)
	.on(deleteMessage, reducers.deleteMessage)
	.on(deleteSwipe, reducers.deleteSwipe);

export const saveCurrentAgentCardFx = createEffect<AgentCard | null, any>((agentCard) =>
	controllers.saveCurrentAgentCard(agentCard),
);

const saveTrigger = createEvent();

const debounceSave = debounce(saveTrigger, 1000);

sample({
	clock: [addNewUserMessage, updateSwipeStream, updateSwipe, deleteMessage, deleteSwipe],
	target: saveTrigger,
});

sample({
	source: $currentAgentCard,
	clock: debounceSave,
	target: [saveCurrentAgentCardFx, chatListModel.updateItemFx],
});
