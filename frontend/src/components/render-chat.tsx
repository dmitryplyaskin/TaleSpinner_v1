import { ChatCard } from "../types/chat";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  chatCard: ChatCard;
};

export const RenderChat: React.FC<Props> = ({ chatCard }) => {
  if (!chatCard) return null;
  const selectedChatHistory = chatCard.chatHistories.find(
    (chatHistory) => chatHistory.id === chatCard.activeChatHistoryId
  );

  return selectedChatHistory.messages.map((message, index) => (
    <div
      key={index}
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`rounded-lg p-3 max-w-[70%] break-words ${
          message.role === "user"
            ? "bg-blue-500 text-white ml-8"
            : "bg-gray-300 mr-8"
        }`}
      >
        <div className="">
          {" "}
          <Markdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </Markdown>{" "}
        </div>
        <div className="text-xs opacity-70 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  ));
};
