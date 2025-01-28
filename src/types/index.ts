import { BaseEntity } from "@core/types/common";

export interface Chat extends BaseEntity {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
  [key: string]: any;
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

export interface SidebarSettings {
  isOpen: boolean;
  isFullscreen: boolean;
  placement: string;
  size: string;
  contained: boolean;
}

export interface SidebarState {
  settings: SidebarSettings;
  chatCards: SidebarSettings;
  userPersons: SidebarSettings;
}
