import { Avatar, Box, Flex, Stack, Text, Textarea } from '@mantine/core';
import { type InteractionMessage } from '@shared/types/agent-card';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { $currentAgentCard, deleteMessage, updateSwipe } from '@model/chat-service';
import { RenderMd } from '@ui/render-md';

import { autosizeTextarea } from '../input/use-autosize-textarea';

import { ActionBar } from './action-bar';
import { AssistantIcon } from './assistant-icon';
import { ReasoningBlock } from './reasoning-block';
import { SwipeControls } from './swipe-controls';

type MessageProps = {
	data: InteractionMessage;
};

export const Message: React.FC<MessageProps> = ({ data }) => {
	const currentAgentCard = useUnit($currentAgentCard);

	const selectedSwipe = useMemo(
		() => data.swipes.find((swipe) => swipe.id === data.activeSwipeId),
		[data.activeSwipeId, data.swipes],
	);
	const answer = useMemo(
		() => selectedSwipe?.components.find((component) => component.type === 'answer'),
		[selectedSwipe],
	);

	const reasoning = useMemo(
		() => selectedSwipe?.components.filter((component) => component.type === 'reasoning') || [],
		[selectedSwipe],
	);

	const answerContent = answer?.content || '';

	const [isEditing, setIsEditing] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const initialContentRef = useRef<string>(answerContent);

	const isUser = data.role === 'user';
	const isAssistant = data.role === 'assistant';
	const assistantName = currentAgentCard?.name || 'AI Assistant';

	useEffect(() => {
		if (!isEditing) initialContentRef.current = answerContent;
	}, [answerContent, isEditing]);

	useEffect(() => {
		if (!isEditing) return;

		const textarea = textareaRef.current;
		if (!textarea) return;

		autosizeTextarea(textarea, { minRows: 1 });
		textarea.focus();
		textarea.setSelectionRange(textarea.value.length, textarea.value.length);
	}, [isEditing]);

	const avatarColW = '64px';

	const handleOpenEdit = () => {
		initialContentRef.current = answerContent;
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
	};

	const handleConfirmEdit = () => {
		if (!answer || !selectedSwipe?.id) return;

		const nextContent = textareaRef.current?.value ?? initialContentRef.current;

		updateSwipe({
			messageId: data.id,
			swipeId: selectedSwipe.id,
			componentId: answer.id,
			content: nextContent,
		});
		setIsEditing(false);
	};

	const handleDelete = () => {
		deleteMessage(data.id);
	};

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
					{reasoning.length > 0 &&
						reasoning.map((reasoning) => (
							<ReasoningBlock
								data={reasoning}
								key={reasoning.id}
								messageId={data.id}
								swipeId={selectedSwipe?.id || ''}
							/>
						))}

					<Box
						style={{
							position: 'relative',
							width: '100%',
							padding: 16,
							borderRadius: 12,
							wordBreak: 'break-word',
							backgroundColor: isUser ? 'var(--mantine-color-violet-0)' : 'white',
							border: '1px solid',
							borderColor: isUser ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
						}}
					>
						<Flex align="center">
							<Stack gap={0}>
								<Text size="sm" fw={600} c={isUser ? 'violet' : 'dark'}>
									{isUser ? 'You' : assistantName}
								</Text>
								<Text size="xs" c="dimmed">
									{new Date(data.timestamp).toLocaleTimeString()}
								</Text>
							</Stack>
						</Flex>

						{answer && selectedSwipe?.id ? (
							<ActionBar
								isEditing={isEditing}
								onOpenEdit={handleOpenEdit}
								onCancelEdit={handleCancelEdit}
								onConfirmEdit={handleConfirmEdit}
								onDelete={handleDelete}
							/>
						) : null}

						<Box mt="xs" style={{ width: '100%', position: 'relative' }}>
							{isEditing ? (
								<Textarea
									ref={textareaRef}
									defaultValue={initialContentRef.current}
									spellCheck={false}
									autosize
									minRows={1}
									onInput={(e) => autosizeTextarea(e.currentTarget, { minRows: 1 })}
								/>
							) : (
								<RenderMd content={answerContent} />
							)}
						</Box>
					</Box>

					<SwipeControls data={data} />
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
