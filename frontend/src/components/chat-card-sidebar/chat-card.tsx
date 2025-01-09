import { Card, HStack, Stack, Text } from "@chakra-ui/react";
import { selectChat } from "@model/chats";
import { ChatCard } from "@types/chat";
import { Avatar } from "@ui/chakra-core-ui/avatar";

type Props = {
  data: ChatCard;
};

export const CharacterCard: React.FC<Props> = ({ data }) => {
  const handleSelect = () => {
    selectChat(data);
  };

  return (
    <Card.Root
      w="100%"
      onClick={handleSelect}
      _hover={{ cursor: "pointer", backgroundColor: "purple.50" }}
    >
      <Card.Body>
        <HStack gap="3">
          <Avatar src={data.imagePath} name={data.title} />
          <Stack gap="0">
            <Text fontWeight="semibold" textStyle="sm">
              {data.title}
            </Text>
            <Text color="fg.muted" textStyle="sm">
              last msg in chat
            </Text>
          </Stack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
