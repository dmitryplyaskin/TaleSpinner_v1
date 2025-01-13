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

  // loadChat(chatId) {
  //   const filePath = path.join(this.chatDir, `${chatId}.json`);
  //   if (!fs.existsSync(filePath)) {
  //     return { messages: [], title: "Новый чат", id: chatId };
  //   }
  //   return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  // }

  // saveChat(chatId, chatData) {
  //   const filePath = path.join(this.chatDir, `${chatId}.json`);
  //   fs.writeFileSync(filePath, JSON.stringify(chatData, null, 2));
  // }

  // deleteChat(chatId) {
  //   const filePath = path.join(this.chatDir, `${chatId}.json`);
  //   if (fs.existsSync(filePath)) {
  //     fs.unlinkSync(filePath);
  //     return true;
  //   }
  //   return false;
  // }

  // updateChatTitle(chatId, newTitle) {
  //   const chat = this.loadChat(chatId);
  //   chat.title = newTitle;
  //   this.saveChat(chatId, chat);
  //   return chat;
  // }

  // createChat(data) {
  //   this.saveChat(data.id, data);
  //   return data;
  // }

  // addMessage(chatId, historyId, message) {
  //   const chat = this.loadChat(chatId);
  //   chat.chatHistories.find((h) => h.id === historyId).messages.push(message);
  //   this.saveChat(chatId, chat);
  //   return chat;
  // }

  // getChatList() {
  //   const files = fs.readdirSync(this.chatDir);
  //   return files
  //     .filter((file) => file.endsWith(".json"))
  //     .map((file) => {
  //       const chatId = file.replace(".json", "");
  //       const chatData = this.loadChat(chatId);
  //       return {
  //         id: chatId,
  //         ...chatData,
  //         // chatHistories: undefined,
  //       };
  //     })
  //     .sort(
  //       (a, b) =>
  //         new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  //     );
  // }
}

module.exports = new ChatService();
