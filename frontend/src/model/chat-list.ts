import { createEffect, createStore } from 'effector';
import { apiRoutes } from '../api-routes';
import { createEmptyChatCard } from './fns';
import { ChatCard } from '../types/chat';

export const $chatList = createStore<ChatCard[]>([]);
export const $currentChatId = createStore('');

export const getChatListFx = createEffect<void, ChatCard[]>(async () => {
	try {
		const response = await fetch(apiRoutes.chat.list()).then((response) => response.json());
		return response;
	} catch (error) {
		console.error('Error fetching chat list:', error);
		return [];
	}
});

export const deleteChatFx = createEffect<ChatCard, void>(async (data) => {
	if (!window.confirm('Вы уверены, что хотите удалить этот чат?')) {
		return;
	}
	try {
		const response = await fetch(apiRoutes.chat.delete(data.id), {
			method: 'DELETE',
		});
		return response.json();
	} catch (error) {
		console.error('Error deleting chat:', error);
		return null;
	}
});

export const createChatFx = createEffect<void, ChatCard>(async () => {
	try {
		const response = await fetch(apiRoutes.chat.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(createEmptyChatCard()),
		});
		return response.json();
	} catch (error) {
		console.error('Error creating chat:', error);
		return null;
	}
});

export const duplicateChatFx = createEffect<ChatCard, ChatCard>(async (data) => {
	try {
		const response = await fetch(apiRoutes.chat.duplicate(data.id), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return response.json();
	} catch (error) {
		console.error('Error duplicating chat:', error);
		return null;
	}
});

$chatList
	.on(getChatListFx.doneData, (_, data) => data)
	.on(deleteChatFx.done, (state, { params }) => state.filter((chat) => chat.id !== params.id))
	.on(createChatFx.doneData, (state, data) => [data, ...state])
	.on(duplicateChatFx.doneData, (state, data) => [data, ...state]);
