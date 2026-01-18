import { Group, Paper, Text } from '@mantine/core';
import { type InteractionMessage } from '@shared/types/agent-card';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';

import { addNewSwipe, changeSwipe } from '@model/chat-service';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type SwipeControlsProps = {
	data: InteractionMessage;
};

export const SwipeControls: React.FC<SwipeControlsProps> = ({ data }) => {
	if (!data.isLast || data.role !== 'assistant') {
		return null;
	}

	const currentSwipeIndex = data.swipes.findIndex((swipe) => swipe.id === data.activeSwipeId);

	const isFirstSwipe = currentSwipeIndex === 0;
	const isLastSwipe = currentSwipeIndex === data.swipes.length - 1;

	const handleSwipeChange = (direction: 'left' | 'right') => {
		if (data.isIntro) {
			changeSwipe(direction);
		} else if (direction === 'right' && isLastSwipe) {
			addNewSwipe();
		} else {
			changeSwipe(direction);
		}
	};

	return (
		<Paper
			withBorder
			radius="md"
			p={6}
			style={{
				marginLeft: 'auto',
				borderColor: 'var(--mantine-color-gray-3)',
				backgroundColor: 'white',
			}}
		>
			<Group gap="xs" align="center">
				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="purple"
					disabled={isFirstSwipe}
					icon={<LuArrowLeft />}
					tooltip="Go back"
					onClick={() => handleSwipeChange('left')}
				/>

				<Text size="xs" c="dimmed">
					{currentSwipeIndex + 1} / {data.swipes.length}
				</Text>
				{(!isLastSwipe || !data.isIntro) && (
					<IconButtonWithTooltip
						size="xs"
						variant="ghost"
						colorPalette="purple"
						icon={<LuArrowRight />}
						tooltip="Go forward"
						onClick={() => handleSwipeChange('right')}
					/>
				)}
			</Group>
		</Paper>
	);
};
