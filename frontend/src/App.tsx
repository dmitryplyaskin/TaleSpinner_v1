import React, { useState, useEffect } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { ChatManagement } from "./components/chat-management";
import { SettingsSidebar } from "./components/settings/SettingsSidebar";
import { v4 as uuidv4 } from "uuid";
import {
  getChatList,
  ChatInfo,
  OpenRouterConfig,
  getOpenRouterConfig,
  updateOpenRouterConfig,
} from "./components/api";
import { $chatList, createChatFx, getChatListFx } from "./model/chats";
import { useUnit } from "effector-react";

interface LLMSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

function App() {
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();
  const chatList = useUnit($chatList);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsSidebarOpen, setIsSettingsSidebarOpen] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LLMSettings>({
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });
  const [apiConfig, setApiConfig] = useState<OpenRouterConfig | null>(null);

  useEffect(() => {
    getChatListFx();
    getOpenRouterConfig().then(setApiConfig);
  }, []);

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {isSidebarOpen && (
        <ChatManagement
          onNewChat={createChatFx}
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-xl font-semibold truncate">
              {currentChatId
                ? chatList.find((c) => c.id === currentChatId)?.title || "Чат"
                : "Выберите чат"}
            </h1>
          </div>
          <button
            onClick={() => setIsSettingsSidebarOpen(!isSettingsSidebarOpen)}
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {currentChatId ? (
            <ChatWindow chatId={currentChatId} settings={llmSettings} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-4">
                  Выберите существующий чат или создайте новый
                </p>
                <button
                  onClick={createChatFx}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Создать новый чат
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsSidebar
        isOpen={isSettingsSidebarOpen}
        onClose={() => setIsSettingsSidebarOpen(false)}
        onLLMSettingsChange={setLlmSettings}
        onAPIConfigChange={async (config) => {
          await updateOpenRouterConfig(config);
          setApiConfig(config);
        }}
        apiConfig={apiConfig}
      />
    </div>
  );
}

export default App;
