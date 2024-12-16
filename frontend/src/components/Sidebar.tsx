import React, { useState } from 'react';
import { OpenRouterConfig, updateOpenRouterConfig, getOpenRouterConfig } from './api';

interface SidebarProps {
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  chatList: { id: string; timestamp: string }[];
  currentChatId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNewChat,
  onSelectChat,
  chatList,
  currentChatId
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<OpenRouterConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleConfigEdit = async () => {
    if (!config) {
      const currentConfig = await getOpenRouterConfig();
      setConfig(currentConfig);
    }
    setIsEditing(true);
  };

  const handleConfigSave = async () => {
    if (config) {
      await updateOpenRouterConfig(config);
      setIsEditing(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center justify-center"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Новый чат
        </button>
      </div>

      <div className="flex-grow overflow-y-auto">
        {chatList.map((chat) => (
          <div
            key={chat.id}
            className={`p-3 cursor-pointer hover:bg-gray-700 ${
              currentChatId === chat.id ? 'bg-gray-700' : ''
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="flex items-center">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <div className="flex-grow">
                <div className="text-sm">Чат {chat.id.slice(0, 8)}...</div>
                <div className="text-xs text-gray-400">
                  {formatDate(chat.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Настройки
        </button>

        {isSettingsOpen && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            {isEditing ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={config?.apiKey || ''}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, apiKey: e.target.value } : null
                      )
                    }
                    className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-white"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Модель
                  </label>
                  <input
                    type="text"
                    value={config?.model || ''}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, model: e.target.value } : null
                      )
                    }
                    className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-white"
                  />
                </div>
                <button
                  onClick={handleConfigSave}
                  className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg"
                >
                  Сохранить
                </button>
              </>
            ) : (
              <button
                onClick={handleConfigEdit}
                className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 rounded-lg"
              >
                Изменить настройки
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
