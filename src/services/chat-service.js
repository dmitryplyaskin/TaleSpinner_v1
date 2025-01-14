const fs = require("fs");
const path = require("path");
const { createDataPath } = require("../utils");
const fileService = require("./file-service");

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
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  async updateChat(data) {
    try {
      const filePath = path.join(this.dir, `${data.id}.json`);
      await fileService.updateFile(filePath, JSON.stringify(data));
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  async deleteChat(chatId) {
    try {
      const filePath = path.join(this.dir, `${chatId}.json`);
      await fileService.deleteFile(filePath);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${filePath}:`, error);
      throw error;
    }
  }

  async addChatMessage() {}

  async updateChatMessage() {}
}

module.exports = new ChatService();
