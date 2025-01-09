import React from "react";

import { Flex, Heading } from "@chakra-ui/react";

import {
  DrawerRoot,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "../../ui/chakra-core-ui/drawer";
import { $sidebars, closeSidebar } from "@model/sidebars";
import { useUnit } from "effector-react";
import { CloseButton } from "@ui/chakra-core-ui/close-button";
import { $chatList } from "@model/chat-list";
import { CharacterCard } from "./chat-card";

export const ChatCardSidebar: React.FC = () => {
  const list = useUnit($chatList);
  const { chatCards: isOpen } = useUnit($sidebars);
  const handleClose = () => {
    closeSidebar("chatCards");
  };

  if (!isOpen) return null;

  return (
    <DrawerRoot
      open={isOpen}
      placement="start"
      size="lg"
      onOpenChange={handleClose}
    >
      <DrawerContent>
        <DrawerHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Card list</Heading>
            <CloseButton onClick={handleClose} />
          </Flex>
        </DrawerHeader>

        <DrawerBody>
          <Flex direction="column" gap="4">
            {list.map((chat) => (
              <CharacterCard key={chat.id} data={chat} />
            ))}
          </Flex>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
};
