import fs from "fs";
import path from "path";
import { createDataPath } from "../utils";
import fileService from "./file-service";
import { v4 as uuidv4 } from "uuid";
import { Chat } from "../types";

const DIR_NAME = "chats";

class ChatService {
  private dir: string;

  constructor() {
    this.dir = createDataPath(DIR_NAME);
    this.ensureChatDirectory();
  }

  private ensureChatDirectory(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  async getChatList(): Promise<Chat[]> {
    try {
      const files = await fileService.getFileList(this.dir, ".json");
      const data: Chat[] = [];

      for await (const file of files) {
        const filePath = path.join(this.dir, file);
        const chat = await fileService.readJson<Chat>(filePath);
        data.push(chat);
      }

      return data.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error("Ошибка при получении списка чатов:", error);
      throw error;
    }
  }

  async getChat(chatId: string): Promise<Chat> {
    try {
      const filePath = path.join(this.dir, `${chatId}.json`);
      return await fileService.readJson<Chat>(filePath);
    } catch (error) {
      console.error(`Ошибка при получении чата ${chatId}:`, error);
      throw error;
    }
  }

  async createChat(data: Chat): Promise<Chat> {
    try {
      const filePath = path.join(this.dir, `${data.id}.json`);
      await fileService.saveFile(filePath, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Ошибка при создании чата:", error);
      throw error;
    }
  }

  async duplicateChat(chatId: string): Promise<Chat> {
    try {
      const originalChat = await this.getChat(chatId);
      const duplicatedChat: Chat = {
        ...originalChat,
        id: uuidv4(),
        title: `${originalChat.title} (копия)`,
        timestamp: new Date().toISOString(),
      };
      await this.createChat(duplicatedChat);
      return duplicatedChat;
    } catch (error) {
      console.error(`Ошибка при дублировании чата ${chatId}:`, error);
      throw error;
    }
  }

  async updateChat(data: Chat): Promise<Chat> {
    try {
      const filePath = path.join(this.dir, `${data.id}.json`);
      await fileService.updateFile(filePath, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Ошибка при обновлении чата:", error);
      throw error;
    }
  }

  async deleteChat(chatId: string): Promise<{ id: string }> {
    try {
      const filePath = path.join(this.dir, `${chatId}.json`);
      await fileService.deleteFile(filePath);
      return { id: chatId };
    } catch (error) {
      console.error(`Ошибка при удалении чата ${chatId}:`, error);
      throw error;
    }
  }
}

export default new ChatService();
