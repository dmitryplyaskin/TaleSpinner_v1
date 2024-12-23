import React, { useState } from "react";
import { ChatListItem } from "./ChatListItem";
import { ChatGrid } from "./ChatGrid";
import { EditChatModal } from "./EditChatModal";
import { ChatInfo, ChatManagementProps } from "./types";
import {
  $chatList,
  deleteChatFx,
  editChatFx,
  saveChatFx,
  toggleEditor,
} from "../../model/chats";
import { useUnit } from "effector-react";

export const ChatManagement: React.FC<ChatManagementProps> = ({
  onNewChat,
  onSelectChat,
  currentChatId,
}) => {
  const chatList = useUnit($chatList);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatInfo | null>(null);

  const handleEditChat = (chatId: string) => {
    const chat = chatList.find((c) => c.id === chatId);
    if (chat) {
      setEditingChat(chat);
      toggleEditor();
    }
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-white z-50">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h1 className="text-xl font-semibold">Все чаты</h1>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatGrid
              chats={chatList}
              currentChatId={currentChatId}
              onSelectChat={(chatId) => {
                onSelectChat(chatId);
                setIsFullscreen(false);
              }}
              onEditChat={handleEditChat}
              onDeleteChat={deleteChatFx}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-gray-50 border-r flex flex-col">
      <div className="p-4 border-b">
        <button
          onClick={onNewChat}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Новый чат
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {chatList.map((chat) => (
            <ChatListItem
              key={chat.id}
              {...chat}
              isSelected={chat.id === currentChatId}
              onSelect={() => onSelectChat(chat.id)}
              onEdit={() => handleEditChat(chat)}
              onDelete={() => deleteChatFx(chat)}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={() => setIsFullscreen(true)}
          className="w-full px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          Показать все чаты
        </button>
      </div>

      {editingChat && (
        <EditChatModal
          chatId={editingChat.id}
          initialTitle={editingChat.title}
          onClose={() => {
            toggleEditor();
            setEditingChat(null);
          }}
          onSave={saveChatFx}
        />
      )}
    </div>
  );
};
