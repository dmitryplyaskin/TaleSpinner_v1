import { createEvent, createStore } from 'effector';

import { ChatCard } from '../types/chat';

export const $currentChat = createStore<ChatCard | null>(null);
export const selectChat = createEvent<ChatCard | null>();

$currentChat.on(selectChat, (_, chat) => chat);
