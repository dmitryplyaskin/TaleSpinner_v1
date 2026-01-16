import { Collapsible, Box, Text, Textarea, Flex } from '@chakra-ui/react';
import { SwipeComponent } from '@shared/types/agent-card';
import { RenderMd } from '@ui/render-md';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { useState } from 'react';
import { ActionBar } from './action-bar';

type ReasoningBlockProps = {
	data: SwipeComponent;
	messageId: string;
	swipeId: string;
};

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ data, messageId, swipeId }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [content, setContent] = useState(data.content);
	const [isOpen, setIsOpen] = useState(false);

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
				data={data}
				messageId={messageId}
				swipeId={swipeId}
				isEditing={isEditing}
				setIsEditing={setIsEditing}
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
							<Textarea w={'100%'} autoresize value={content} onChange={(e) => setContent(e.target.value)} />
						) : (
							<RenderMd content={data.content} />
						)}
					</Box>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
};
