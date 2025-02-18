import { Flex, Box } from '@chakra-ui/react';
import { SwipeComponent } from '@shared/types/agent-card';
import { LuPen, LuCheck, LuX, LuTrash } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { useState } from 'react';
import { deleteMessage, updateSwipe } from '@model/chat-service';

type ActionBarProps = {
	data: SwipeComponent;
	messageId: string;
	swipeId: string;
	isEditing: boolean;
	setIsEditing: (isEditing: boolean) => void;
	coordinates?: {
		top: number;
		right: number;
	};
};

export const ActionBar = ({
	data,
	messageId,
	swipeId,
	isEditing,
	setIsEditing,
	coordinates = { top: 3, right: 3 },
}: ActionBarProps) => {
	const [content, setContent] = useState(data.content);

	const handleOpenEdit = () => {
		setContent(data.content);
		setIsEditing(true);
	};

	const handleDelete = () => {
		deleteMessage(messageId);
	};

	const handleConfirmEdit = () => {
		updateSwipe({
			messageId,
			swipeId,
			componentId: data.id,
			content,
		});
		setIsEditing(false);
	};

	const handleCancelEdit = () => {
		setContent(data.content);
		setIsEditing(false);
	};

	return (
		<Box position="absolute" top={coordinates.top} right={coordinates.right} gap={2} alignSelf="flex-start">
			{isEditing ? (
				<Flex gap={1}>
					<IconButtonWithTooltip
						size="xs"
						variant="solid"
						colorPalette="red"
						icon={<LuX />}
						tooltip="Cancel edit"
						aria-label="Cancel edit"
						onClick={handleCancelEdit}
					/>
					<IconButtonWithTooltip
						size="xs"
						variant="solid"
						colorPalette="green"
						icon={<LuCheck />}
						tooltip="Confirm edit"
						aria-label="Confirm edit"
						onClick={handleConfirmEdit}
					/>
				</Flex>
			) : (
				<Flex gap={1}>
					<IconButtonWithTooltip
						size="xs"
						variant="ghost"
						colorPalette="purple"
						icon={<LuPen />}
						tooltip="Edit message"
						aria-label="Edit message"
						onClick={handleOpenEdit}
					/>
					<IconButtonWithTooltip
						size="xs"
						variant="ghost"
						colorPalette="red"
						icon={<LuTrash />}
						tooltip="Delete message"
						aria-label="Delete message"
						onClick={handleDelete}
					/>
				</Flex>
			)}
		</Box>
	);
};
