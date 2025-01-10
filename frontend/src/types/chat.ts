export interface ChatCard {
	id: string;
	title: string;
	createdTimestamp: string;
	lastUpdatedTimestamp: string;
	lastMessage?: Message;
	systemPrompt?: string;
	introMessages: Message[];
	chatHistories: ChatHistory[];
	activeChatHistoryId: string | null;
	metadata?: Record<string, any>;
	rating?: '1' | '2' | '3' | '4' | '5';
	isFavorite?: boolean;
	imagePath?: string;
	currentChat?: CurrentChat;
}
export interface ChatHistory {
	id: string;
	name?: string;
	createdTimestamp: string;
	selectedIntroMessageId?: string;
	messages: ChatMessage[];
}

export interface ChatMessage {
	id: string;
	type: 'default';
	content: Message[];
	role: 'user' | 'assistant' | 'system';
	timestamp: string;
	currentContentId?: string;
}

export interface Message {
	id: string;
	content: string;
	timestamp: string;
}

export interface CurrentChat {
	chatHistory: ChatHistory;
	messages: ChatMessage[];
}
