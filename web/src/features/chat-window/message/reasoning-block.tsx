import { Box, Collapsible, Flex, Text, Textarea } from '@chakra-ui/react';
import { type SwipeComponent } from '@shared/types/agent-card';
import { useEffect, useRef, useState } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

import { RenderMd } from '@ui/render-md';

import { deleteMessage, updateSwipe } from '@model/chat-service';

import { autosizeTextarea } from '../input/use-autosize-textarea';

import { ActionBar } from './action-bar';

type ReasoningBlockProps = {
	data: SwipeComponent;
	messageId: string;
	swipeId: string;
};

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ data, messageId, swipeId }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const initialContentRef = useRef<string>(data.content);

	useEffect(() => {
		if (!isEditing) initialContentRef.current = data.content;
	}, [data.content, isEditing]);

	useEffect(() => {
		if (!isEditing) return;

		const textarea = textareaRef.current;
		if (!textarea) return;

		autosizeTextarea(textarea, { minRows: 1 });
		textarea.focus();
		textarea.setSelectionRange(textarea.value.length, textarea.value.length);
	}, [isEditing]);

	const handleOpenEdit = () => {
		initialContentRef.current = data.content;
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
	};

	const handleConfirmEdit = () => {
		const nextContent = textareaRef.current?.value ?? initialContentRef.current;

		updateSwipe({
			messageId,
			swipeId,
			componentId: data.id,
			content: nextContent,
		});
		setIsEditing(false);
	};

	const handleDelete = () => {
		deleteMessage(messageId);
	};

	return (
		<Box
			position="relative"
			maxW="full"
			w={'100%'}
			backgroundColor="white"
			borderRadius="lg"
			p={4}
			borderWidth={1}
			borderColor="gray.200"
		>
			<ActionBar
				isEditing={isEditing}
				onOpenEdit={handleOpenEdit}
				onCancelEdit={handleCancelEdit}
				onConfirmEdit={handleConfirmEdit}
				onDelete={handleDelete}
			/>
			<Collapsible.Root unmountOnExit onOpenChange={(d) => setIsOpen(d.open)} open={isOpen}>
				<Collapsible.Trigger>
					<Flex align="center" gap={2}>
						<Text fontSize="sm" fontWeight="semibold" color="gray.800">
							Reasoning
						</Text>
						{isOpen ? <LuChevronUp /> : <LuChevronDown />}
					</Flex>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Box padding="4" borderWidth="1px" mt={2}>
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
							<RenderMd content={data.content} />
						)}
					</Box>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
};
