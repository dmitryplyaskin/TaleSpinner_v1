import { Box, Flex, Grid, GridItem, Text, Textarea, VStack } from '@chakra-ui/react';
import { type InteractionMessage } from '@shared/types/agent-card';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { $currentAgentCard, deleteMessage, updateSwipe } from '@model/chat-service';
import { Avatar } from '@ui/chakra-core-ui/avatar';
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
		<Grid w="full" templateColumns={`${avatarColW} 1fr ${avatarColW}`} columnGap={2} alignItems="start">
			<GridItem w={avatarColW} display="flex" justifyContent="flex-start">
				{isAssistant ? <AssistantIcon boxSize="16" size="xl" /> : <Box w={avatarColW} />}
			</GridItem>

			<GridItem minW={0}>
				<VStack align="stretch" gap={2} w="full">
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
						position="relative"
						w="full"
						p={4}
						borderRadius="lg"
						bg={isUser ? 'purple.50' : 'white'}
						borderWidth={1}
						borderColor={isUser ? 'purple.400' : 'gray.200'}
						wordBreak="break-word"
					>
						<Flex align="center">
							<VStack align="flex-start" gap={0}>
								<Text fontSize="sm" fontWeight="semibold" color={isUser ? 'purple.600' : 'gray.800'}>
									{isUser ? 'You' : assistantName}
								</Text>
								<Text fontSize="xs" opacity={0.7}>
									{new Date(data.timestamp).toLocaleTimeString()}
								</Text>
							</VStack>
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

						<Box mt={2} w="full" position="relative">
							{isEditing ? (
								<Textarea
									ref={textareaRef}
									w="full"
									rows={1}
									resize="none"
									overflow="hidden"
									defaultValue={initialContentRef.current}
									spellCheck={false}
									onInput={(e) => autosizeTextarea(e.currentTarget, { minRows: 1 })}
								/>
							) : (
								<RenderMd content={answerContent} />
							)}
						</Box>
					</Box>

					<SwipeControls data={data} />
				</VStack>
			</GridItem>

			<GridItem w={avatarColW} display="flex" justifyContent="flex-end">
				{isUser ? (
					<Avatar size="xl" boxSize="16" name="User" src="/user-avatar.png" bg="purple.500" />
				) : (
					<Box w={avatarColW} />
				)}
			</GridItem>
		</Grid>
	);
};
