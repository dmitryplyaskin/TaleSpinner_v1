import { Box, Flex } from '@mantine/core';
import { LuPen, LuCheck, LuX, LuTrash } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type ActionBarProps = {
	isEditing: boolean;
	onOpenEdit: () => void;
	onCancelEdit: () => void;
	onConfirmEdit: () => void;
	onDelete: () => void;
	coordinates?: {
		top: number;
		right: number;
	};
};

export const ActionBar = ({
	isEditing,
	onOpenEdit,
	onCancelEdit,
	onConfirmEdit,
	onDelete,
	coordinates = { top: 3, right: 3 },
}: ActionBarProps) => {
	return (
		<Box
			style={{
				position: 'absolute',
				top: coordinates.top,
				right: coordinates.right,
				alignSelf: 'flex-start',
			}}
		>
			{isEditing ? (
				<Flex gap={4}>
					<IconButtonWithTooltip
						size="xs"
						variant="solid"
						colorPalette="red"
						icon={<LuX />}
						tooltip="Cancel edit"
						aria-label="Cancel edit"
						onClick={onCancelEdit}
					/>
					<IconButtonWithTooltip
						size="xs"
						variant="solid"
						colorPalette="green"
						icon={<LuCheck />}
						tooltip="Confirm edit"
						aria-label="Confirm edit"
						onClick={onConfirmEdit}
					/>
				</Flex>
			) : (
				<Flex gap={4}>
					<IconButtonWithTooltip
						size="xs"
						variant="ghost"
						colorPalette="purple"
						icon={<LuPen />}
						tooltip="Edit message"
						aria-label="Edit message"
						onClick={onOpenEdit}
					/>
					<IconButtonWithTooltip
						size="xs"
						variant="ghost"
						colorPalette="red"
						icon={<LuTrash />}
						tooltip="Delete message"
						aria-label="Delete message"
						onClick={onDelete}
					/>
				</Flex>
			)}
		</Box>
	);
};
