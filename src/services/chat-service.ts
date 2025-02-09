import { Chat } from "../types";
import { BaseService } from "@core/services/base-service";

class ChatService extends BaseService<Chat> {
  constructor() {
    super("chats", { logger: console });
  }
}

export const chatService = { service: new ChatService() };
