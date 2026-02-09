import { Box, Flex } from '@mantine/core';
import { LuPen, LuCheck, LuX, LuTrash } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { Z_INDEX } from '@ui/z-index';

type ActionBarProps = {
	isEditing: boolean;
	onOpenEdit: () => void;
	onCancelEdit: () => void;
	onConfirmEdit: () => void;
	onDelete: () => void;
	placement?: 'absolute' | 'inline';
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
	placement = 'absolute',
	coordinates = { top: 3, right: 3 },
}: ActionBarProps) => {
	return (
		<Box
			style={{
				position: placement === 'absolute' ? 'absolute' : 'static',
				top: placement === 'absolute' ? coordinates.top : undefined,
				right: placement === 'absolute' ? coordinates.right : undefined,
				alignSelf: placement === 'absolute' ? 'flex-start' : undefined,
				zIndex: placement === 'absolute' ? Z_INDEX.local.messageActionBar : undefined,
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
						colorPalette="violet"
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
