export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface UserPerson {
  id: string;
  name: string;
  description: string;
  systemMessage: string;
}

export interface Settings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}
