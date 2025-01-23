const fs = require("fs");
const path = require("path");
const { createDataPath } = require("../utils");
const fileService = require("./file-service");
const { v4: uuidv4 } = require("uuid");

const DIR_NAME = "chats";
class ChatService {
  constructor() {
    this.dir = createDataPath(DIR_NAME);
    this.ensureChatDirectory();
  }

  ensureChatDirectory() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  async getChatList(sortSettings) {
    try {
      const files = await fileService.getFileList(this.dir, ".json");
      const data = [];

      for await (const file of files) {
        const filePath = path.join(this.dir, file);
        const chat = await fileService.readJson(filePath);
        data.push(chat);
      }

      return data.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  async getChat(chatId) {
    try {
      const filePath = path.join(this.dir, `${chatId}.json`);
      const chat = await fileService.readJson(filePath);
      return chat;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  async createChat(data) {
    try {
      const filePath = path.join(this.dir, `${data.id}.json`);
      await fileService.saveFile(filePath, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  async duplicateChat(chatId) {
    try {
      const originalChat = await this.getChat(chatId);
      const duplicatedChat = {
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

  async updateChat(data) {
    try {
      const filePath = path.join(this.dir, `${data.id}.json`);
      await fileService.updateFile(filePath, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  async deleteChat(chatId) {
    try {
      const filePath = path.join(this.dir, `${chatId}.json`);
      await fileService.deleteFile(filePath);
      return { id: chatId };
    } catch (error) {
      console.error(`Ошибка при удалении файла ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new ChatService();
