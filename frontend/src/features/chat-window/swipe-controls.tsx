import { Flex, Text } from '@chakra-ui/react';
import { LuArrowLeft, LuArrowRight } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { InteractionMessage } from '@shared/types/agent-card';
import { addNewSwipe, changeSwipe } from '@model/chat-service';

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
		<Flex justify="flex-end" align="center" gap={2} mt={2}>
			{!isFirstSwipe && (
				<IconButtonWithTooltip
					size="xs"
					variant="ghost"
					colorPalette="purple"
					icon={<LuArrowLeft />}
					tooltip="Go back"
					onClick={() => handleSwipeChange('left')}
				/>
			)}
			<Text fontSize="xs" opacity={0.7}>
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
		</Flex>
	);
};
