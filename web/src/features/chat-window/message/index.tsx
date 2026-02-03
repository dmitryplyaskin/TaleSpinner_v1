import { Avatar, Box, Flex, Stack, Text } from '@mantine/core';
import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';
import { useUnit } from 'effector-react';
import { useMemo } from 'react';

import { $currentEntityProfile } from '@model/chat-core';
import { $currentTurn, $isChatStreaming } from '@model/chat-entry-parts';

import { AssistantIcon } from './assistant-icon';
import { VariantControls } from './variant-controls';
import { PartsView } from './parts/parts-view';

type MessageProps = {
	data: ChatEntryWithVariantDto;
	isLast: boolean;
};

export const Message: React.FC<MessageProps> = ({ data, isLast }) => {
	const currentProfile = useUnit($currentEntityProfile);
	const isStreaming = useUnit($isChatStreaming);
	const currentTurn = useUnit($currentTurn);

	const isUser = data.entry.role === 'user';
	const isAssistant = data.entry.role === 'assistant';
	const assistantName = currentProfile?.name || 'AI Assistant';
	const tsLabel = useMemo(() => new Date(data.entry.createdAt).toLocaleTimeString(), [data.entry.createdAt]);

	const avatarColW = '64px';
	const isOptimistic =
		String(data.entry.entryId).startsWith('local_') || (typeof data.entry.meta === 'object' && Boolean((data.entry.meta as any)?.optimistic));

	return (
		<Box
			style={{
				width: '100%',
				display: 'grid',
				gridTemplateColumns: `${avatarColW} 1fr ${avatarColW}`,
				columnGap: 8,
				alignItems: 'start',
			}}
		>
			<Box style={{ width: avatarColW, display: 'flex', justifyContent: 'flex-start' }}>
				{isAssistant ? <AssistantIcon size={64} /> : <Box style={{ width: avatarColW }} />}
			</Box>

			<Box style={{ minWidth: 0 }}>
				<Stack gap="xs" style={{ width: '100%' }}>
					<Box
						style={{
							position: 'relative',
							width: '100%',
							padding: 20,
							borderRadius: 12,
							wordBreak: 'break-word',
							backgroundColor: isUser ? 'var(--mantine-color-violet-0)' : 'white',
							border: '1px solid',
							borderColor: isUser ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
						}}
					>
						<Flex align="center" justify="space-between" gap="sm">
							<Stack gap={0}>
								<Text size="sm" fw={600} c={isUser ? 'violet' : 'dark'}>
									{isUser ? 'You' : assistantName}
								</Text>
								<Text size="xs" c="dimmed">
									{tsLabel}
								</Text>
								{isLast && isAssistant && isStreaming && (
									<Text size="xs" c="dimmed">
										Streaming…
									</Text>
								)}
								{isOptimistic && (
									<Text size="xs" c="dimmed">
										Saving…
									</Text>
								)}
							</Stack>
							{isAssistant && <VariantControls entry={data} isLast={isLast} />}
						</Flex>

						<Box mt="xs" style={{ width: '100%', position: 'relative' }}>
							<PartsView entry={data.entry} variant={data.variant} currentTurn={currentTurn} />
						</Box>
					</Box>
				</Stack>
			</Box>

			<Box style={{ width: avatarColW, display: 'flex', justifyContent: 'flex-end' }}>
				{isUser ? (
					<Avatar size={64} name="User" src="/user-avatar.png" color="violet" radius="xl" />
				) : (
					<Box style={{ width: avatarColW }} />
				)}
			</Box>
		</Box>
	);
};
