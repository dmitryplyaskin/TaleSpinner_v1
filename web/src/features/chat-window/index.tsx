import { Box, Container, Flex } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useRef } from 'react';

import BGImages from '../../assets/bg.png';

import { $currentAgentCard } from '@model/chat-service';

import { MessageInput } from './input';
import { RenderChat } from './render-chat';

export const ChatWindow: React.FC = () => {
	const currentAgentCard = useUnit($currentAgentCard);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!currentAgentCard) return;

		const scrollToBottom = () => {
			messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
		};

		// Two frames to let layout settle (messages + images).
		requestAnimationFrame(() => {
			scrollToBottom();
			requestAnimationFrame(scrollToBottom);
		});
	}, [currentAgentCard?.id]);

	return (
		<Flex
			direction="column"
			style={{
				height: '100%',
				minHeight: 0,
				backgroundImage: `url(${BGImages})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
			}}
		>
			<Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
				<Container size="xl" py="md">
					<RenderChat />
					<Box ref={messagesEndRef} />
				</Container>
			</Box>

			<Container size="xl" py={0}>
				<MessageInput />
			</Container>
		</Flex>
	);
};
