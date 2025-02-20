import { Box, Code, Flex, HStack, Mark, Text, VStack } from '@chakra-ui/react';
import { Collapsible } from '@chakra-ui/react';
import { LuChevronDown, LuChevronUp, LuMoveUp, LuMoveDown, LuTrash2, LuPlay } from 'react-icons/lu';
import { FormInput } from '@ui/form-components/form-input';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { FormCheckbox } from '@ui/form-components/form-checkbox';
import { useFormContext } from 'react-hook-form';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { useState } from 'react';
import { pipelineCompletionsFx } from '@model/llm-orchestration/completions';

type PipelineItemProps = {
	index: number;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
};

export const PipelineItem: React.FC<PipelineItemProps> = ({
	index,
	onRemove,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const { watch, getValues } = useFormContext();
	const name = watch(`pipelines.${index}.name`);

	return (
		<Box borderWidth="1px" borderRadius="md" p={4}>
			<Collapsible.Root open={isOpen} onOpenChange={({ open }) => setIsOpen(open)}>
				<Collapsible.Trigger asChild>
					<Flex alignItems="center" justifyContent="space-between" cursor="pointer">
						<Flex alignItems="center" gap={2}>
							{isOpen ? <LuChevronDown /> : <LuChevronUp />}
							<Box fontWeight="medium">{name || `Pipeline ${index + 1}`}</Box>
						</Flex>
						<Flex gap={2}>
							{!isFirst && (
								<IconButtonWithTooltip
									aria-label="Move up"
									icon={<LuMoveUp />}
									tooltip="Move Up"
									size="sm"
									variant="ghost"
									onClick={(e) => {
										e.stopPropagation();
										onMoveUp();
									}}
								/>
							)}
							{!isLast && (
								<IconButtonWithTooltip
									aria-label="Move down"
									icon={<LuMoveDown />}
									tooltip="Move Down"
									size="sm"
									variant="ghost"
									onClick={(e) => {
										e.stopPropagation();
										onMoveDown();
									}}
								/>
							)}
							<IconButtonWithTooltip
								aria-label="Remove pipeline"
								icon={<LuTrash2 />}
								tooltip="Remove Pipeline"
								size="sm"
								variant="ghost"
								colorScheme="red"
								onClick={(e) => {
									e.stopPropagation();
									onRemove();
								}}
							/>
						</Flex>
					</Flex>
				</Collapsible.Trigger>

				<Collapsible.Content>
					<Flex pt={4} gap={4} direction="column">
						<Flex gap={4}>
							<FormInput name={`pipelines.${index}.name`} label="Pipeline Name" placeholder="Enter pipeline name" />
							<FormInput
								name={`pipelines.${index}.tag`}
								label="Pipeline Tag"
								placeholder="Enter pipeline tag"
								fieldProps={{ maxWidth: '140px' }}
								infoTip={
									<VStack p={2} gap={1} align="flex-start">
										<Text>The tag allows the result of this Pipeline to be used in subsequent Pipelines. </Text>
										<Text>For example:</Text>
										<Code variant="solid">{`Some Prompt: {{tag}}`}</Code>
									</VStack>
								}
							/>
						</Flex>
						<FormTextarea name={`pipelines.${index}.prompt`} label="Prompt" placeholder="Enter pipeline prompt" />
						<HStack>
							<FormCheckbox name={`pipelines.${index}.enabled`} label="Enable Pipeline" />
							<FormCheckbox name={`pipelines.${index}.addToChatHistory`} label="Add to Chat History" />
						</HStack>
						<HStack>
							<FormCheckbox name={`pipelines.${index}.showToUserInChat`} label="Show to User in Chat" />
							<FormCheckbox name={`pipelines.${index}.addToPrompt`} label="Add to Prompt" />
						</HStack>

						<HStack justifyContent="flex-end">
							<IconButtonWithTooltip
								aria-label="Run pipeline"
								icon={<LuPlay />}
								tooltip="Run Pipeline"
								size="sm"
								variant="solid"
								colorPalette="green"
								onClick={() => {
									pipelineCompletionsFx({ pipeline: getValues(`pipelines.${index}`) });
								}}
							/>
						</HStack>
					</Flex>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
};
