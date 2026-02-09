import { Box } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useRef } from 'react';

import { $currentChat } from '@model/chat-core';
import { $entries } from '@model/chat-entry-parts';

import BGImages from '../../assets/bg.png';


import { ChatHeader } from './chat-header';
import { MessageInput } from './input';
import { RenderChat } from './render-chat';

export const ChatWindow: React.FC = () => {
	const chat = useUnit($currentChat);
	const entries = useUnit($entries);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!chat) return;

		const scrollToBottom = () => {
			messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
		};

		requestAnimationFrame(() => {
			scrollToBottom();
			requestAnimationFrame(scrollToBottom);
		});
	}, [chat, chat?.id, entries.length]);

	return (
		<Box className="ts-chat-window" style={{ backgroundImage: `url(${BGImages})` }}>
			<Box className="ts-chat-window__inner">
				<Box className="ts-chat-scroll">
					<ChatHeader />
					<Box className="ts-chat-content">
						<RenderChat />
						<Box ref={messagesEndRef} style={{ scrollMarginBottom: 160 }} />

						<Box className="ts-chat-composer-wrap">
							<MessageInput />
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
};
