import { Box, Flex, Text, Textarea, VStack } from '@chakra-ui/react';

import { Avatar } from '@ui/chakra-core-ui/avatar';
import { useMemo, useState } from 'react';
import { InteractionMessage } from '@shared/types/agent-card';
import { RenderMd } from '@ui/render-md';
import { SwipeControls } from './swipe-controls';
import { AssistantIcon } from './assistant-icon';
import { ReasoningBlock } from './reasoning-block';
import { ActionBar } from './action-bar';

type MessageProps = {
	data: InteractionMessage;
};

export const Message: React.FC<MessageProps> = ({ data }) => {
	const selectedSwipe = useMemo(() => data.swipes.find((swipe) => swipe.id === data.activeSwipeId), [data]);
	const answer = useMemo(
		() => selectedSwipe?.components.find((component) => component.type === 'answer'),
		[selectedSwipe],
	);

	const reasoning = useMemo(
		() => selectedSwipe?.components.filter((component) => component.type === 'reasoning') || [],
		[selectedSwipe],
	);

	const answerContent = answer?.content || '';

	const [content, setContent] = useState(answerContent);
	const [isEditing, setIsEditing] = useState(false);

	const isUser = data.role === 'user';
	const isAssistant = data.role === 'assistant';

	return (
		<Flex justify={isUser ? 'flex-end' : 'flex-start'} gap={2}>
			{isAssistant && <AssistantIcon />}
			<VStack align="flex-start" gap={2} pr={isUser ? 0 : '50px'}>
				{reasoning.length > 0 &&
					reasoning.map((reasoning) => (
						<ReasoningBlock data={reasoning} key={reasoning.id} messageId={data.id} swipeId={selectedSwipe?.id || ''} />
					))}
				<Box
					position="relative"
					maxW={'full'}
					w={isUser ? 'auto' : 'full'}
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
								{isUser ? 'You' : 'AI Assistant'}
							</Text>
							<Text fontSize="xs" opacity={0.7}>
								{new Date(data.timestamp).toLocaleTimeString()}
							</Text>
						</VStack>
					</Flex>
					<ActionBar
						data={answer!}
						messageId={data.id}
						swipeId={selectedSwipe?.id || ''}
						isEditing={isEditing}
						setIsEditing={setIsEditing}
					/>
					<Box mt={2} w={'100%'}>
						{isEditing ? (
							<Textarea w={'100%'} autoresize value={content} onChange={(e) => setContent(e.target.value)} />
						) : (
							<RenderMd content={answerContent} />
						)}
					</Box>
				</Box>
				<SwipeControls data={data} />
			</VStack>
			{isUser && <Avatar size="lg" name="User" src="/user-avatar.png" bg="purple.500" />}
		</Flex>
	);
};
