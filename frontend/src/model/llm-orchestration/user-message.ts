import { createEvent, createStore } from 'effector';

export const $userMessage = createStore<string>('');
export const setUserMessage = createEvent<string>();
export const clearUserMessage = createEvent();

$userMessage.on(setUserMessage, (_, message) => message).on(clearUserMessage, () => '');
