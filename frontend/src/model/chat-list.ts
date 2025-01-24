import { createEffect, createStore } from 'effector';
import { apiRoutes } from '../api-routes';
import { createEmptyChatCard } from './fns';
import { ChatCard } from '../types/chat';
import { asyncHandler } from './utils/async-handler';

export const $chatList = createStore<ChatCard[]>([]);
export const $currentChatId = createStore('');

export const getChatListFx = createEffect<void, { data: ChatCard[] }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.list());
		return response.json();
	}, 'Error fetching chat list'),
);

export const deleteChatFx = createEffect<ChatCard, void>((data) =>
	asyncHandler(async () => {
		if (!window.confirm('Вы уверены, что хотите удалить этот чат?')) {
			return;
		}
		const response = await fetch(apiRoutes.chat.delete(data.id), {
			method: 'DELETE',
		});
		return response.json();
	}, 'Error deleting chat'),
);

export const createChatFx = createEffect<void, { data: ChatCard }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(createEmptyChatCard()),
		});
		return response.json();
	}, 'Error creating chat'),
);

export const duplicateChatFx = createEffect<ChatCard, { data: ChatCard }>((data) =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.chat.duplicate(data.id), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return response.json();
	}, 'Error duplicating chat'),
);

$chatList
	.on(getChatListFx.doneData, (_, { data }) => data)
	.on(deleteChatFx.done, (state, { params }) => state.filter((chat) => chat.id !== params.id))
	.on(createChatFx.doneData, (state, { data }) => [data, ...state])
	.on(duplicateChatFx.doneData, (state, { data }) => [data, ...state]);
