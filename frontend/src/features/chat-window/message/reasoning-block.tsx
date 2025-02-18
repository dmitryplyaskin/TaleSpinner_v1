import { Collapsible, Box, Text } from '@chakra-ui/react';
import { SwipeComponent } from '@shared/types/agent-card';
import { RenderMd } from '@ui/render-md';

type ReasoningBlockProps = {
	data: SwipeComponent;
};

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ data }) => {
	return (
		<Box maxW="full" w={'100%'} backgroundColor="white" borderRadius="lg" p={4} borderWidth={1} borderColor="gray.200">
			<Collapsible.Root unmountOnExit>
				<Collapsible.Trigger>
					<Text fontSize="sm" fontWeight="semibold" color="gray.800">
						Reasoning
					</Text>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Box padding="4" borderWidth="1px" mt={2}>
						<RenderMd content={data.content} />
					</Box>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
};
