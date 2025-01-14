import { createEffect, createEvent, createStore, sample } from 'effector';

import { ChatCard, ChatMessage } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';
import { BASE_URL } from '../const';
import { condition } from 'patronum/condition';

export const $currentChat = createStore<ChatCard | null>(null);
export const selectChat = createEvent<ChatCard | null>();

$currentChat.on(selectChat, (_, chat) => chat);

// Обновление контента сообщения
export const updateMessageContent = createEvent<{
	messageId: string;
	contentId: string;
	content: string;
}>();

// Удаление сообщения или его альтернативы
export const deleteMessage = createEvent<{
	messageId: string;
	contentId: string;
}>();

export const addUserMessage = createEvent<{ message: ChatMessage; chatHistoryId: string }>();

$currentChat.on(addUserMessage, (state, { message, chatHistoryId }) => {
	if (!state) return null;

	const currentChatHistory =
		state.chatHistories.find((history) => history.id === chatHistoryId) || state.chatHistories[0];

	const newChatHistory = {
		...currentChatHistory,
		messages: [...currentChatHistory.messages, message],
	};

	return {
		...state,
		chatHistories: state.chatHistories.map((history) => (history.id === chatHistoryId ? newChatHistory : history)),
	};
});

$currentChat.on(updateMessageContent, (state, { messageId, content: newContent, contentId }) => {
	if (!state) return null;

	const currentChatHistory =
		state.chatHistories.find((history) => history.id === state.activeChatHistoryId) || state.chatHistories[0];

	const newChatHistory = {
		...currentChatHistory,
		messages: currentChatHistory.messages.map((message) => {
			if (message.id !== messageId) return message;

			const content = message.content.map((content) => {
				if (content.id !== contentId) return content;

				return {
					...content,
					content: newContent,
				};
			});

			return {
				...message,
				content,
			};
		}),
	};

	return {
		...state,
		chatHistories: state.chatHistories.map((history) =>
			history.id === state.activeChatHistoryId ? newChatHistory : history,
		),
	};
});

$currentChat.on(deleteMessage, (state, { messageId, contentId }) => {
	if (!state) return null;

	const currentChatHistory =
		state.chatHistories.find((history) => history.id === state.activeChatHistoryId) || state.chatHistories[0];

	let newMessages = currentChatHistory.messages.map((message) => {
		if (message.id !== messageId) return message;

		const newContent = message.content.filter((content) => content.id !== contentId);

		return {
			...message,
			content: newContent,
		};
	});

	if (newMessages[newMessages.length - 1].content.length === 0) {
		newMessages = newMessages.slice(0, -1);
	}

	const newChatHistory = {
		...currentChatHistory,
		messages: newMessages,
	};

	return {
		...state,
		chatHistories: state.chatHistories.map((history) =>
			history.id === state.activeChatHistoryId ? newChatHistory : history,
		),
	};
});

export const $currentChatFormatted = $currentChat.map((chat) => {
	if (!chat) return null;

	const currentChatHistory =
		chat.chatHistories.find((history) => history.id === chat.activeChatHistoryId) || chat.chatHistories[0] || {};

	const introMessage =
		chat.introMessages.find((message) => message.id === currentChatHistory.selectedIntroMessageId) || null;

	const messages = [] as ChatMessage[];

	if (introMessage) {
		const msg = {
			id: uuidv4(),
			content: [introMessage],
			role: 'assistant',
			type: 'default',
			timestamp: new Date().toISOString(),
		} as ChatMessage;

		messages.push(msg);
	}

	currentChatHistory?.messages.forEach((message) => {
		const currentMsgId = message.currentContentId;
		const currentMsg = message.content.find((content) => content.id === currentMsgId);
		if (currentMsg) {
			messages.push({ ...message, content: [currentMsg] });
		} else {
			messages.push({ ...message, content: [message.content[0]] });
		}
	});

	return {
		...chat,
		currentChat: {
			chatHistory: currentChatHistory,
			messages: messages,
		},
	} as ChatCard;
});

export const saveCurrentChatFx = createEffect<ChatCard | null, void>(async (data) => {
	if (!data) return;
	try {
		const response = await fetch(`${BASE_URL}/chats/${data.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
		return response.json();
	} catch (error) {
		console.error('Error saving chat:', error);
		return null;
	}
});

const $stopSave = createStore(false);
export const toggleStopSave = createEvent();

$stopSave.on(toggleStopSave, (stop) => !stop);

condition({
	source: $currentChat,
	if: $stopSave,
	else: saveCurrentChatFx,
});

// sample({
// 	clock: $currentChat,
// 	target: saveCurrentChatFx,
// });
