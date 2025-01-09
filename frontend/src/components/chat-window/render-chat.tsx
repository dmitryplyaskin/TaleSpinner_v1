import { ChatCard } from "../../types/chat";
import { VStack } from "@chakra-ui/react";
import { Message } from "./message";

type Props = {
  chatCard: ChatCard | null;
};

export const RenderChat: React.FC<Props> = ({ chatCard }) => {
  if (!chatCard) return null;

  const selectedChatHistory =
    chatCard.chatHistories.find(
      (chatHistory) => chatHistory.id === chatCard.activeChatHistoryId
    ) || chatCard.chatHistories[0];

  return (
    <VStack gap={4} align="stretch">
      {selectedChatHistory.messages.map((message, index) => (
        <Message key={index} data={message} />
      ))}
    </VStack>
  );
};
