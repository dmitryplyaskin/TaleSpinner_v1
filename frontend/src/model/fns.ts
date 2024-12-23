import { ChatCard } from "../types/chat";
import { v4 as uuidv4 } from "uuid";

export const createEmptyChatCard = (title: string = "Новый чат"): ChatCard => {
  const now = new Date().toISOString();
  return {
    id: uuidv4(), // Генерируем уникальный ID
    title: title,
    createdTimestamp: now,
    lastUpdatedTimestamp: now,
    introMessages: [],
    chatHistories: [
      {
        id: uuidv4(), // Генерируем уникальный ID
        name: "Новый чат",
        createdTimestamp: now,
        messages: [],
      },
    ],
    activeChatHistoryId: null,
  };
};
