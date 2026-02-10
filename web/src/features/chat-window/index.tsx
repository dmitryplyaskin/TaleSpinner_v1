import { Box } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useRef, useState } from 'react';

import { $currentChat } from '@model/chat-core';
import { $entries } from '@model/chat-entry-parts';

import BGImages from '../../assets/bg.png';

import { AvatarPreviewPanel, type ChatAvatarPreview } from './avatar-preview-panel';
import { MessageInput } from './input';
import { MessageActionModals } from './message/message-action-modals';
import { RenderChat } from './render-chat';

export const ChatWindow: React.FC = () => {
	const chat = useUnit($currentChat);
	const entries = useUnit($entries);
	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<ChatAvatarPreview | null>(null);

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

	useEffect(() => {
		setAvatarPreview(null);
	}, [chat?.id]);

	return (
		<Box className="ts-chat-window" style={{ backgroundImage: `url(${BGImages})` }}>
			<Box className="ts-chat-window__inner" data-preview-open={avatarPreview ? 'true' : 'false'}>
				<Box className="ts-chat-scroll">
					<Box className="ts-chat-content">
						<RenderChat onAvatarPreviewRequested={setAvatarPreview} />
						<Box ref={messagesEndRef} style={{ scrollMarginBottom: 160 }} />

						<Box className="ts-chat-composer-wrap">
							<MessageInput />
						</Box>
					</Box>
				</Box>

				<AvatarPreviewPanel preview={avatarPreview} onClose={() => setAvatarPreview(null)} />
			</Box>
			<MessageActionModals />
		</Box>
	);
};
