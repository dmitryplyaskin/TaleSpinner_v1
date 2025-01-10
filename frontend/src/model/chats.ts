import { createEvent, createStore } from 'effector';

import { ChatCard } from '../types/chat';

export const $currentChat = createStore<ChatCard | null>(null);
export const selectChat = createEvent<ChatCard | null>();

$currentChat.on(selectChat, (_, chat) => chat);

// Обновление контента сообщения
export const updateMessageContent = createEvent<{
  messageId: string;
  content: string;
  alternativeId?: string;
}>();

// Удаление сообщения или его альтернативы
export const deleteMessage = createEvent<{
  messageId: string;
  alternativeId?: string;
}>();

$currentChat.on(updateMessageContent, (state, { messageId, content, alternativeId }) => {
  if (!state) return null;

  return {
    ...state,
    chatHistories: state.chatHistories.map(history => ({
      ...history,
      messages: history.messages.map(message => {
        if (message.id !== messageId) return message;

        if (alternativeId) {
          // Обновляем контент в alternatives
          return {
            ...message,
            alternatives: message.alternatives?.map(alt => 
              alt.id === alternativeId ? { ...alt, content } : alt
            ),
          };
        }

        // Обновляем основной контент
        return {
          ...message,
          content,
        };
      }),
    })),
  };
});

$currentChat.on(deleteMessage, (state, { messageId, alternativeId }) => {
  if (!state) return null;

  return {
    ...state,
    chatHistories: state.chatHistories.map(history => ({
      ...history,
      messages: history.messages.map(message => {
        if (message.id !== messageId) return message;

        if (alternativeId) {
          // Удаляем конкретную альтернативу
          return {
            ...message,
            alternatives: message.alternatives?.filter(alt => alt.id !== alternativeId),
          };
        }

        // Если есть альтернативы и удаляем основной контент
        if (message.alternatives?.length) {
          const [firstAlternative, ...remainingAlternatives] = message.alternatives;
          return {
            ...message,
            content: firstAlternative.content,
            alternatives: remainingAlternatives,
          };
        }

        return message;
      }).filter(message => message.id !== messageId || alternativeId),
    })),
  };
});
