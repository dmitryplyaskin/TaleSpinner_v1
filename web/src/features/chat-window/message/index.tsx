import { Avatar, Box, Flex, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { $currentEntityProfile } from '@model/chat-core';
import { $currentTurn, $isChatStreaming } from '@model/chat-entry-parts';

import { AssistantIcon } from './assistant-icon';
import { PartsView } from './parts/parts-view';
import { VariantControls } from './variant-controls';

import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';

type MessageProps = {
	data: ChatEntryWithVariantDto;
	isLast: boolean;
};

export const Message: React.FC<MessageProps> = ({ data, isLast }) => {
	const { t } = useTranslation();
	const currentProfile = useUnit($currentEntityProfile);
	const isStreaming = useUnit($isChatStreaming);
	const currentTurn = useUnit($currentTurn);

	const isUser = data.entry.role === 'user';
	const isAssistant = data.entry.role === 'assistant';
	const assistantName = currentProfile?.name || t('chat.message.assistantFallback');
	const tsLabel = useMemo(() => new Date(data.entry.createdAt).toLocaleTimeString(), [data.entry.createdAt]);

	const isOptimistic =
		String(data.entry.entryId).startsWith('local_') || (typeof data.entry.meta === 'object' && Boolean((data.entry.meta as any)?.optimistic));

	return (
		<Box className="ts-message-grid">
			<Box className="ts-message-avatar ts-message-avatar--assistant">
				{isAssistant ? <AssistantIcon size={52} /> : <Box className="ts-message-avatar-spacer" />}
			</Box>

			<Box style={{ minWidth: 0 }}>
				<Stack gap="xs" style={{ width: '100%' }}>
					<Box className="ts-message-card" data-role={isUser ? 'user' : 'assistant'}>
						<Flex align="center" justify="space-between" gap="sm">
							<Stack gap={0}>
								<Text size="sm" className="ts-message-name" data-role={isUser ? 'user' : 'assistant'}>
									{isUser ? t('chat.message.you') : assistantName}
								</Text>
								<Text size="xs" className="ts-message-meta">
									{tsLabel}
								</Text>
								{isLast && isAssistant && isStreaming && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.streaming')}
									</Text>
								)}
								{isOptimistic && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.saving')}
									</Text>
								)}
							</Stack>
							{isAssistant && <VariantControls entry={data} isLast={isLast} />}
						</Flex>

						<Box className="ts-message-body ts-chat-serif">
							<PartsView entry={data.entry} variant={data.variant} currentTurn={currentTurn} />
						</Box>
					</Box>
				</Stack>
			</Box>

			<Box className="ts-message-avatar ts-message-avatar--user">
				{isUser ? <Avatar size={52} name="User" src="/user-avatar.png" color="cyan" radius="xl" /> : <Box className="ts-message-avatar-spacer" />}
			</Box>
		</Box>
	);
};
