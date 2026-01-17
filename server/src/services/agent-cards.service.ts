import { type AgentCardSettingsType } from "@shared/types/agent-card";

import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";

import { type Chat } from "../types";

class ChatService extends BaseService<Chat> {
  constructor() {
    super("agent-cards", { logger: console });
  }

  async getChatList(): Promise<Chat[]> {
    return await this.getAll();
  }

  async getChat(chatId: string): Promise<Chat> {
    return await this.getById(chatId);
  }

  async createChat(chat: Chat): Promise<Chat> {
    const now = new Date().toISOString();

    const newChat: Chat = {
      ...chat,
      id: chat.id || this.createUUID(),
      createdAt: chat.createdAt || now,
      updatedAt: now,
    };

    return await this.create(newChat);
  }

  async updateChat(chat: Chat): Promise<Chat> {
    if (!chat.id) {
      throw new Error("chat.id обязателен");
    }

    const now = new Date().toISOString();

    const updatedChat: Chat = {
      ...chat,
      updatedAt: now,
      createdAt: chat.createdAt || now,
    };

    return await this.update(updatedChat);
  }

  async deleteChat(chatId: string): Promise<string> {
    return await this.delete(chatId);
  }

  async duplicateChat(chatId: string): Promise<Chat> {
    const original = await this.getById(chatId);
    const now = new Date().toISOString();

    const duplicated: Chat = {
      ...original,
      id: this.createUUID(),
      createdAt: now,
      updatedAt: now,
    };

    return await this.create(duplicated);
  }
}

class ChatSettings extends ConfigService<AgentCardSettingsType> {
  constructor() {
    super("agent-cards.json", { logger: console });
  }

  getDefaultConfig(): AgentCardSettingsType {
    return {
      selectedId: null,
      enabled: true,
    };
  }
}

export const chatService = {
  service: new ChatService(),
  settings: new ChatSettings(),
};
