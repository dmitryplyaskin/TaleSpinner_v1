import { Chat } from "../types";
import { BaseService } from "@core/services/base-service";

class ChatService extends BaseService<Chat> {
  constructor() {
    super("chats", { logger: console });
  }

  async getChatList(): Promise<Chat[]> {
    return await this.getAll();
  }

  async getChat(chatId: string): Promise<Chat> {
    return await this.getById(chatId);
  }

  async createChat(data: Chat): Promise<Chat> {
    return await this.create(data);
  }

  async duplicateChat(chatId: string): Promise<Chat> {
    return await this.duplicate(chatId);
  }

  async updateChat(data: Chat): Promise<Chat> {
    return await this.update(data.id, data);
  }

  async deleteChat(chatId: string): Promise<void> {
    return await this.delete(chatId);
  }
}

export default new ChatService();
