import { ChatCard } from "../../types/chat";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Flex, Box, Text } from "@chakra-ui/react";

type Props = {
  chatCard: ChatCard;
};

export const RenderChat: React.FC<Props> = ({ chatCard }) => {
  if (!chatCard) return null;
  const selectedChatHistory =
    chatCard.chatHistories.find(
      (chatHistory) => chatHistory.id === chatCard.activeChatHistoryId
    ) || chatCard.chatHistories[0];

  return selectedChatHistory.messages.map((message, index) => (
    <Flex
      key={index}
      justify={message.role === "user" ? "flex-end" : "flex-start"}
    >
      <Box
        maxW={message.role === "user" ? "70%" : "full"}
        p={3}
        borderRadius="lg"
        bg={message.role === "user" ? "purple.50" : "white"}
        borderWidth={1}
        border={message.role === "user" ? "1px solid #8b5cf6" : "none"}
        wordBreak="break-word"
      >
        <Box>
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        </Box>
        <Text fontSize="xs" opacity={0.7} mt={1}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </Text>
      </Box>
    </Flex>
  ));
};
