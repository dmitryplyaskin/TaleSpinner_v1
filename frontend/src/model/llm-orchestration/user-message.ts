import { createEvent, createStore, sample } from 'effector';

export const $userMessage = createStore<string>('');
export const setUserMessage = createEvent<string>();
export const clearUserMessage = createEvent();
export const sendUserMessage = createEvent();

$userMessage.on(setUserMessage, (_, message) => message).on(clearUserMessage, () => '');

sample({
	clock: sendUserMessage,
	source: $userMessage,
	filter: (message) => message.trim().length > 0,
	target: [clearUserMessage],
});

export const $isProcessing = createStore(false);
