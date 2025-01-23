import { Chat } from "../types";
import { BaseService } from "@core/services/base-service";

class ChatService extends BaseService<Chat> {
  constructor() {
    super("chats", { logger: console });
  }

  async getChatList(): Promise<Chat[]> {
    return await this.getAllJSON();
  }

  async getChat(chatId: string): Promise<Chat> {
    return await this.getJSONById(chatId);
  }

  async createChat(data: Chat): Promise<Chat> {
    return await this.createJSON(data);
  }

  async duplicateChat(chatId: string): Promise<Chat> {
    return await this.duplicateJSON(chatId);
  }

  async updateChat(data: Chat): Promise<Chat> {
    return await this.updateJSON(data.id, data);
  }

  async deleteChat(chatId: string): Promise<void> {
    return await this.deleteJSON(chatId);
  }
}

export default new ChatService();
