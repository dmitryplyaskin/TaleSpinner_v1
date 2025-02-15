import React, { useState, useRef } from 'react';

import { RenderChat } from './render-chat';

import { Flex, Box, Container } from '@chakra-ui/react';

import { MessageInput } from './message-input';

export const ChatWindow: React.FC = () => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	return (
		<Flex direction="column" h="full">
			<Box flex="1" overflowY="auto" bg="gray.100">
				<Container maxW="6xl" p={4}>
					<RenderChat />
					<div ref={messagesEndRef} />
				</Container>
			</Box>

			<MessageInput />
		</Flex>
	);
};
