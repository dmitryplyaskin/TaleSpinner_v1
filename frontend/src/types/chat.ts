export interface ChatCard {
  id: string;
  title: string;
  createdTimestamp: string;
  lastUpdatedTimestamp: string;
  systemPrompt?: string;
  introMessages: ChatMessage[];
  chatHistories: ChatHistory[];
  activeChatHistoryId: string | null;
  metadata?: Record<string, any>;
  rating?: number; // Оценка карточки пользователем
  isFavorite?: boolean; // Добавлена ли карточка в избранное
  imagePath?: string; // Путь к картинке карточки
}

export interface ChatHistory {
  id: string;
  name?: string;
  createdTimestamp: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: string;
  parentMessageId?: string;
  isFirstInBranch?: boolean;
  alternatives?: ChatMessageAlternative[];
}

export interface ChatMessageAlternative {
  id: string;
  content: string;
  timestamp: string;
}
