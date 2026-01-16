import React, { useRef } from 'react';
import { RenderChat } from './render-chat';
import { Flex, Box, Container } from '@chakra-ui/react';
import { MessageInput } from './input';

import BGImages from '../../assets/bg.png';

export const ChatWindow: React.FC = () => {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	return (
		<Flex
			direction="column"
			h="full"
			backgroundImage={`url(${BGImages})`}
			backgroundSize="cover"
			backgroundPosition="center"
		>
			<Box flex="1" overflowY="auto" pb={'300px'}>
				<Container maxW="6xl" p={4}>
					<RenderChat />
					<div ref={messagesEndRef} />
				</Container>
			</Box>

			<MessageInput />
		</Flex>
	);
};
