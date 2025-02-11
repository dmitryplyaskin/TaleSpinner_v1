import { createStore, createEvent, sample } from 'effector';
import { AgentCard, InteractionMessage } from '@shared/types/agent-card';
import { reducers } from './reducers';
import { debounce } from 'patronum/debounce';
import { chatListModel } from '../chat-list';
import { produce } from 'immer';

export const $currentAgentCard = createStore<AgentCard | null>(null);
export const setCurrentAgentCard = createEvent<AgentCard>();

$currentAgentCard.on(setCurrentAgentCard, (_, card) =>
	produce(card, (draft) => {
		const activeBranch = draft.interactionBranches.find((branch) => branch.id === draft.activeBranchId);
		if (!activeBranch || !activeBranch.isStarted) return;

		const messages = activeBranch.messages.map((x, index, arr) =>
			arr.length - 1 === index ? { ...x, isLast: true } : x,
		);

		if (messages.length === 0 && draft.introSwipes.swipes.length > 0) {
			const introSwipes = { ...draft.introSwipes, isIntro: true } as InteractionMessage;
			messages.push(introSwipes);
		}

		activeBranch.messages = messages;
	}),
);

export const $isAgentSelected = $currentAgentCard.map((agentCard) => !!agentCard);

export const $currentChat = $currentAgentCard.map((agentCard) => {
	if (!agentCard) return [];

	const activeBranch =
		agentCard.interactionBranches.find((branch) => branch.id === agentCard.activeBranchId) ||
		agentCard.interactionBranches[0];

	if (!activeBranch) return [];

	return activeBranch.messages;
});

$currentAgentCard.watch(console.log);

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

export const addNewSwipe = createEvent<void>();
export const changeSwipe = createEvent<'left' | 'right'>();

const updater = createEvent();

$currentAgentCard
	.on(addNewUserMessage, reducers.addNewUserMessage)
	.on(addNewAssistantMessage, reducers.addNewAssistantMessage)
	.on(updateSwipeStream, reducers.updateSwipeStream)
	.on(updateSwipe, reducers.updateSwipe)
	.on(deleteMessage, reducers.deleteMessage)
	.on(deleteSwipe, reducers.deleteSwipe)
	.on(addNewSwipe, reducers.addNewSwipe)
	.on(changeSwipe, reducers.changeSwipe)
	.on(updater, reducers.updater);

// export const saveCurrentAgentCardFx = createEffect<AgentCard | null, any>((agentCard) =>
// 	controllers.saveCurrentAgentCard(agentCard),
// );

const saveTrigger = createEvent();

const debounceSave = debounce(saveTrigger, 1000);

sample({
	clock: [addNewUserMessage, updateSwipeStream, updateSwipe, deleteMessage, deleteSwipe, addNewSwipe, changeSwipe],
	target: updater,
});
sample({
	clock: updater,
	target: saveTrigger,
});

sample({
	source: $currentAgentCard,
	clock: debounceSave,
	target: [chatListModel.updateItemFx],
});
