import { Box, Container, Flex } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useRef } from 'react';

import BGImages from '../../assets/bg.png';

import { $currentChat, $messages } from '@model/chat-core';

import { ChatHeader } from './chat-header';
import { MessageInput } from './input';
import { RenderChat } from './render-chat';

export const ChatWindow: React.FC = () => {
	const chat = useUnit($currentChat);
	const messages = useUnit($messages);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!chat) return;

		const scrollToBottom = () => {
			messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
		};

		// Two frames to let layout settle (messages + images).
		requestAnimationFrame(() => {
			scrollToBottom();
			requestAnimationFrame(scrollToBottom);
		});
	}, [chat?.id, messages.length]);

	return (
		<Flex
			direction="column"
			align="stretch"
			style={{
				height: '100%',
				minHeight: 0,
				width: '100%',
				backgroundImage: `url(${BGImages})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
			}}
		>
			<Container
				size="xl"
				py={0}
				style={{
					flex: 1,
					minHeight: 0,
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<Box
					style={{
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
						paddingTop: 0,
						paddingBottom: 0,
						backgroundColor: 'rgba(0,0,0,0.08)',
						backdropFilter: 'blur(4px)',
						borderRadius: 12,
						paddingInline: 12,
					}}
				>
					<ChatHeader />
					<Box pt={16}>
					<RenderChat />
					<Box ref={messagesEndRef} style={{ scrollMarginBottom: 160 }} />

					<Box
						style={{
							position: 'sticky',
							bottom: 0,
							paddingTop: 12,
						}}
					>
						<MessageInput />
					</Box>
					</Box>
				</Box>
			</Container>
		</Flex>
	);
};
