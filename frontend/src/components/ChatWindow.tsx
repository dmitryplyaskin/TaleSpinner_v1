import React, { useState, useEffect, useRef } from "react";
import { streamMessage, getChatHistory, ChatMessage } from "./api";
import { RenderChat } from "./render-chat";

interface ChatWindowProps {
  chatId: string;
  llmSettings: {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  llmSettings,
}) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history = await getChatHistory(chatId);

        setMessages(history.messages || []);
        setChat(history);
      } catch (error) {
        console.error("Error loading chat history:", error);
        setMessages([]);
      }
    };

    loadChatHistory();
  }, [chatId]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(event.target.value);
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === "" || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setIsStreaming(true);

    try {
      const messageStream = streamMessage(newMessage, chatId, llmSettings);
      let botMessage: ChatMessage = {
        role: "bot",
        content: "",
        timestamp: new Date().toISOString(),
      };

      let isFirstChunk = true;

      for await (const chunk of messageStream) {
        if ("error" in chunk) {
          botMessage.content = `Ошибка: ${chunk.error}`;
          break;
        }

        if (isFirstChunk) {
          setMessages((prev) => [...prev, botMessage]);
          isFirstChunk = false;
        }

        botMessage.content += chunk.content;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === "bot") {
            lastMessage.content = botMessage.content;
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: ChatMessage = {
        role: "bot",
        content:
          "Произошла ошибка при генерации ответа. Пожалуйста, попробуйте еще раз.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          <RenderChat chatCard={chat} />
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 bg-white border-t shadow-md">
        <div className="max-w-5xl mx-auto flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Введите сообщение..."
            disabled={isStreaming}
            className="flex-grow p-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={isStreaming || !newMessage.trim()}
            className={`px-4 py-2 text-white rounded-lg whitespace-nowrap ${
              isStreaming || !newMessage.trim()
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isStreaming ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
};
