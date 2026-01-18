import { Box, Collapse, Group, Paper, Text, Textarea, UnstyledButton } from '@mantine/core';
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
		<Paper
			withBorder
			radius="md"
			p="md"
			style={{ position: 'relative', width: '100%', borderColor: 'var(--mantine-color-gray-3)' }}
		>
			<ActionBar
				isEditing={isEditing}
				onOpenEdit={handleOpenEdit}
				onCancelEdit={handleCancelEdit}
				onConfirmEdit={handleConfirmEdit}
				onDelete={handleDelete}
			/>
			<UnstyledButton
				onClick={() => setIsOpen((v) => !v)}
				style={{ width: '100%', display: 'block' }}
				aria-expanded={isOpen}
			>
				<Group gap="xs" align="center">
					<Text size="sm" fw={600}>
						Reasoning
					</Text>
					{isOpen ? <LuChevronUp /> : <LuChevronDown />}
				</Group>
			</UnstyledButton>
			<Collapse in={isOpen}>
				<Box mt="xs" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}>
					{isEditing ? (
						<Textarea
							ref={textareaRef}
							defaultValue={initialContentRef.current}
							spellCheck={false}
							autosize
							minRows={1}
							style={{ width: '100%' }}
							styles={{
								root: { width: '100%' },
								input: { width: '100%', display: 'block' },
							}}
							onInput={(e) => autosizeTextarea(e.currentTarget, { minRows: 1 })}
						/>
					) : (
						<RenderMd content={data.content} />
					)}
				</Box>
			</Collapse>
		</Paper>
	);
};
