import chatService from "@services/chat-service";
import { AsyncRequestHandler } from "../common/middleware/async-handler";

export const getChatHistory: AsyncRequestHandler = async (req) => {
  const chats = await chatService.getChatList();
  return { data: chats };
};

export const getChat: AsyncRequestHandler = async (req) => {
  const chat = await chatService.getChat(req.params.chatId);
  return { data: chat };
};

export const createChat: AsyncRequestHandler = async (req) => {
  const chat = await chatService.createChat(req.body);
  return { data: chat };
};

export const duplicateChat: AsyncRequestHandler = async (req) => {
  const duplicatedChat = await chatService.duplicateChat(req.params.chatId);
  return { data: duplicatedChat };
};

export const updateChat: AsyncRequestHandler = async (req) => {
  const updatedChat = await chatService.updateChat(req.body);
  return { data: updatedChat };
};

export const deleteChat: AsyncRequestHandler = async (req) => {
  await chatService.deleteChat(req.params.chatId);
  return { data: {} };
};
