import React, { useState, useEffect } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { Sidebar } from './components/Sidebar';
import { v4 as uuidv4 } from 'uuid';
import { getChatHistory } from './components/api';

interface ChatInfo {
  id: string;
  timestamp: string;
}

function App() {
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();
  const [chatList, setChatList] = useState<ChatInfo[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Load chat list from localStorage on mount
    const savedChats = localStorage.getItem('chatList');
    if (savedChats) {
      setChatList(JSON.parse(savedChats));
    }
  }, []);

  const handleNewChat = () => {
    const newChatId = uuidv4();
    const newChat: ChatInfo = {
      id: newChatId,
      timestamp: new Date().toISOString(),
    };
    
    setChatList((prev) => {
      const updated = [newChat, ...prev];
      localStorage.setItem('chatList', JSON.stringify(updated));
      return updated;
    });
    
    setCurrentChatId(newChatId);
  };

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {isSidebarOpen && (
        <Sidebar
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          chatList={chatList}
          currentChatId={currentChatId}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b p-4 flex items-center">
          <button
            onClick={toggleSidebar}
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
            {currentChatId ? `Чат ${currentChatId.slice(0, 8)}...` : 'Выберите чат'}
          </h1>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {currentChatId ? (
            <ChatWindow chatId={currentChatId} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="mb-4">Выберите существующий чат или создайте новый</p>
                <button
                  onClick={handleNewChat}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Создать новый чат
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
