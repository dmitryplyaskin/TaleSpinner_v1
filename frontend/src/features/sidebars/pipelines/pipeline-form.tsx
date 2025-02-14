import { Box, Flex } from '@chakra-ui/react';
import { Collapsible } from '@chakra-ui/react';
import { LuChevronDown, LuChevronUp, LuMoveUp, LuMoveDown, LuTrash2 } from 'react-icons/lu';
import { FormInput } from '@ui/form-components/form-input';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { FormCheckbox } from '@ui/form-components/form-checkbox';
import { useFormContext } from 'react-hook-form';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { useState } from 'react';

type PipelineFormProps = {
	index: number;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
};

export const PipelineForm: React.FC<PipelineFormProps> = ({
	index,
	onRemove,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const { watch } = useFormContext();
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
							/>
						</Flex>
						<FormTextarea
							name={`pipelines.${index}.description`}
							label="Description"
							placeholder="Enter pipeline description"
						/>
						<FormCheckbox name={`pipelines.${index}.enabled`} label="Enable Pipeline" />
					</Flex>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
};
