import React from "react";
import { ChatListItem } from "./ChatListItem";
import { ChatInfo } from "./types";

interface ChatGridProps {
  chats: ChatInfo[];
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
  onEditChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export const ChatGrid: React.FC<ChatGridProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onEditChat,
  onDeleteChat,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <ChatListItem
            id={chat.id}
            title={chat.title}
            timestamp={chat.timestamp}
            isSelected={chat.id === currentChatId}
            onSelect={() => onSelectChat(chat.id)}
            onEdit={() => onEditChat(chat.id)}
            onDelete={() => onDeleteChat(chat)}
          />
        </div>
      ))}
    </div>
  );
};
