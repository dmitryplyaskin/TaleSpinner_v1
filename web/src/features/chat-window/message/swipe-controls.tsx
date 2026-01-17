import { Flex, Text } from '@chakra-ui/react';
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
		<Flex
			ml="auto"
			align="center"
			gap={2}
			p={2}
			backgroundColor="white"
			borderRadius="lg"
			borderWidth={1}
			borderColor="gray.200"
		>
			<IconButtonWithTooltip
				size="xs"
				variant="ghost"
				colorPalette="purple"
				disabled={isFirstSwipe}
				icon={<LuArrowLeft />}
				tooltip="Go back"
				onClick={() => handleSwipeChange('left')}
			/>

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
