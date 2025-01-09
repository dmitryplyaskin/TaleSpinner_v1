import { Box, Flex, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LuPen } from "react-icons/lu";
import { ChatMessage } from "../api";
import { IconButtonWithTooltip } from "@ui/icon-button-with-tooltip";
import { Avatar } from "@ui/chakra-core-ui/avatar";

type MessageProps = {
  data: ChatMessage;
};

export const Message: React.FC<MessageProps> = ({ data }) => {
  const isUser = data.role === "user";

  return (
    <Flex justify={isUser ? "flex-end" : "flex-start"} gap={2}>
      {!isUser && (
        <Avatar
          size="lg"
          name="AI Assistant"
          src="/ai-avatar.png"
          bg="purple.500"
        />
      )}
      <Box
        position="relative"
        maxW={isUser ? "70%" : "full"}
        p={3}
        borderRadius="lg"
        bg={isUser ? "purple.50" : "white"}
        borderWidth={1}
        borderColor={isUser ? "purple.400" : "gray.200"}
        wordBreak="break-word"
        mr={isUser ? 0 : "50px"}
      >
        <Flex align="center">
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color={isUser ? "purple.600" : "gray.800"}
          >
            {isUser ? "You" : "AI Assistant"}
          </Text>
          <Box ml="auto">
            <IconButtonWithTooltip
              position="absolute"
              top={1}
              right={1}
              size="xs"
              variant="ghost"
              colorScheme="purple"
              icon={<LuPen />}
              tooltip="Edit message"
              aria-label="Edit message"
            />
          </Box>
        </Flex>
        <Box mt={2}>
          <Markdown remarkPlugins={[remarkGfm]}>{data.content}</Markdown>
        </Box>
        <Text fontSize="xs" opacity={0.7} mt={1}>
          {new Date(data.timestamp).toLocaleTimeString()}
        </Text>
      </Box>
      {isUser && (
        <Avatar size="lg" name="User" src="/user-avatar.png" bg="purple.500" />
      )}
    </Flex>
  );
};
