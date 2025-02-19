import { attach, createEffect, createEvent, createStore, sample } from 'effector';
import {
	$currentAgentCard,
	addNewAssistantMessage,
	addNewSwipe,
	addNewUserMessage,
	updateSwipeStream,
} from '../chat-service';
import { buildMessages } from '../../utils/build-messages';
import { streamController } from './stream-controller';
import { createNewMessage, createNewSwipeComponent } from '@utils/creation-helper-agent-card';
import { generate } from './generate';
import { $userMessage, clearUserMessage } from './user-message';
import { templatesModel } from '@model/template';
import { renderTemplate } from './render-template';
import { getLastMessageState } from '@utils/get-agent-card-ids';
import { PipelineItemType } from '@shared/types/pipelines';

type CompletionType = 'new-message' | 'new-swipe' | 'current-message';

type CompletionsFxProps = {
	type: CompletionType;
	userMessage: string;
};

export const $currentStreamIdMap = createStore<Record<string, string>>({});
export const addStreamId = createEvent<{ streamId: string; streamName: string }>();
export const removeStreamId = createEvent<string>();

$currentStreamIdMap
	.on(addStreamId, (state, { streamId, streamName }) => ({
		...state,
		[streamId]: streamName,
	}))
	.on(removeStreamId, (state, streamId) => {
		const newState = { ...state };
		delete newState[streamId];
		return newState;
	});

export const $isCompletionsProcessing = createStore(false);

export const completionsFx = createEffect(async ({ type, userMessage }: CompletionsFxProps) => {
	const streamId_ = streamController.createStream();
	addStreamId({ streamId: streamId_, streamName: 'chat-completions' });

	if (userMessage) {
		const userMessage_ = createNewMessage({ role: 'user', content: userMessage });
		addNewUserMessage(userMessage_.message);
	}

	const agentCard = $currentAgentCard.getState();
	if (!agentCard) return;

	let messages = buildMessages(agentCard);

	const template = templatesModel.$selectedItem.getState();
	const templateSettings = templatesModel.$settings.getState();

	if (template?.template && templateSettings.enabled) {
		messages.unshift({ role: 'system', content: renderTemplate(template.template) });
	}

	let assistantMessage = {} as ReturnType<typeof createNewMessage>;
	if (type === 'new-swipe' || type === 'current-message') {
		assistantMessage = getLastMessageState(agentCard)!;
	} else {
		assistantMessage = createNewMessage({ role: 'assistant', content: '' });
		addNewAssistantMessage(assistantMessage.message);
	}

	await generate({
		llmSettings: undefined,
		messages,
		stream: true,
		streamId: streamId_,
		streamCb: ({ chunk }) => {
			updateSwipeStream({
				messageId: assistantMessage.messageId,
				swipeId: assistantMessage.swipeId,
				componentId: assistantMessage.contentId,
				content: chunk,
			});
		},
	});
});

export const attachCompletionsFx = attach({
	source: { agentCard: $currentAgentCard, userMessage: $userMessage },
	effect: completionsFx,
	mapParams: (type: CompletionType, source) => ({
		type,
		userMessage: source.userMessage,
	}),
});

$isCompletionsProcessing.on(attachCompletionsFx, () => true).on(attachCompletionsFx.finally, () => false);

sample({
	clock: addNewSwipe,
	fn: () => 'new-swipe' as const,
	target: [attachCompletionsFx],
});

sample({
	clock: completionsFx,
	target: [clearUserMessage],
});

type PipelineCompletionsFxProps = {
	pipeline: PipelineItemType;
};

export const pipelineCompletionsFx = createEffect(async ({ pipeline }: PipelineCompletionsFxProps) => {
	const streamId_ = streamController.createStream();
	addStreamId({ streamId: streamId_, streamName: pipeline.id });

	const agentCard = $currentAgentCard.getState();
	if (!agentCard) return;

	let messages = buildMessages(agentCard);
	const msgPrompt = messages
		.map((message) => `${message.role === 'user' ? '[{{user}}]' : '[{{char}}]'}: ${message.content}`)
		.join('\n\n');

	const assistantMessage = createNewMessage({ role: 'assistant', content: '' });
	const newSwipeComponent = createNewSwipeComponent({ content: '', type: 'reasoning' });

	assistantMessage.message.swipes[0].components.unshift(newSwipeComponent.content);

	addNewAssistantMessage(assistantMessage.message);

	const prompt = `
You're a game master who looks up to roleplaying and who plays the role of {{char}}. Your job is to run a chain of thought on behalf of {{char}}.
You need to think and ponder like {{char}} and then come up with a correct response plan for the next post as part of the roleplay.

This is the character description:
{{description}}

This is chat history:
${msgPrompt}

!!!IMPORTANT!!!
You need to think and ponder like {{char}} and then come up with a correct response plan for the next post as part of the roleplay.
`;

	const templatedPrompt = renderTemplate(prompt);

	await generate({
		llmSettings: undefined,
		messages: [{ role: 'system', content: templatedPrompt }],
		stream: true,
		streamId: streamId_,
		streamCb: ({ chunk }) => {
			updateSwipeStream({
				messageId: assistantMessage.messageId,
				swipeId: assistantMessage.swipeId,
				componentId: newSwipeComponent.contentId,
				content: chunk,
			});
		},
	});

	await completionsFx({ type: 'current-message', userMessage: '' });
});
