const fs = require('fs');
const path = require('path');

class ChatService {
  constructor() {
    this.chatDir = path.join(__dirname, '..', '..', 'public', 'chats');
    this.ensureChatDirectory();
  }

  ensureChatDirectory() {
    if (!fs.existsSync(this.chatDir)) {
      fs.mkdirSync(this.chatDir, { recursive: true });
    }
  }

  loadChat(chatId) {
    const filePath = path.join(this.chatDir, `${chatId}.json`);
    if (!fs.existsSync(filePath)) {
      return { messages: [], title: 'Новый чат', id: chatId };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  saveChat(chatId, chatData) {
    console.log(chatData)
    const filePath = path.join(this.chatDir, `${chatId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(chatData, null, 2));
  }

  deleteChat(chatId) {
    const filePath = path.join(this.chatDir, `${chatId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  updateChatTitle(chatId, newTitle) {
    const chat = this.loadChat(chatId);
    chat.title = newTitle;
    this.saveChat(chatId, chat);
    return chat;
  }

  addMessage(chatId, message) {
    const chat = this.loadChat(chatId);
    chat.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    this.saveChat(chatId, chat);
    return chat;
  }

  getChatList() {
    const files = fs.readdirSync(this.chatDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const chatId = file.replace('.json', '');
        const chatData = this.loadChat(chatId);
        return {
          id: chatId,
          title: chatData.title || 'Новый чат',
          timestamp: chatData.timestamp || new Date().toISOString()
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

module.exports = new ChatService();
