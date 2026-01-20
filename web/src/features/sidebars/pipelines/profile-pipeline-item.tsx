import { Badge, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { LuChevronDown, LuChevronUp, LuMoveDown, LuMoveUp, LuTrash2 } from 'react-icons/lu';

import { FormCheckbox } from '@ui/form-components/form-checkbox';
import { FormInput } from '@ui/form-components/form-input';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type ProfilePipelineItemProps = {
	index: number;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
};

export const ProfilePipelineItem: React.FC<ProfilePipelineItemProps> = ({
	index,
	onRemove,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const { watch, control } = useFormContext();
	const name = watch(`pipelines.${index}.name`) as unknown;
	const enabled = watch(`pipelines.${index}.enabled`) as unknown;

	const { fields: stepFields } = useFieldArray({
		control,
		name: `pipelines.${index}.steps`,
		keyName: '_key',
	});

	return (
		<Paper withBorder radius="md" p="sm">
			<Group
				justify="space-between"
				align="center"
				onClick={() => setIsOpen((v) => !v)}
				style={{ cursor: 'pointer' }}
				wrap="nowrap"
			>
				<Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
					{isOpen ? <LuChevronDown /> : <LuChevronUp />}
					<Text fw={500} truncate>
						{typeof name === 'string' && name.trim().length > 0 ? name : `Pipeline ${index + 1}`}
					</Text>
					{enabled === false && (
						<Badge color="gray" variant="light">
							disabled
						</Badge>
					)}
				</Group>
				<Group gap="xs" wrap="nowrap">
					{!isFirst && (
						<IconButtonWithTooltip
							aria-label="Move up"
							icon={<LuMoveUp />}
							tooltip="Move up"
							size="sm"
							variant="ghost"
							onClick={(e: MouseEvent<HTMLButtonElement>) => {
								e.stopPropagation();
								onMoveUp();
							}}
						/>
					)}
					{!isLast && (
						<IconButtonWithTooltip
							aria-label="Move down"
							icon={<LuMoveDown />}
							tooltip="Move down"
							size="sm"
							variant="ghost"
							onClick={(e: MouseEvent<HTMLButtonElement>) => {
								e.stopPropagation();
								onMoveDown();
							}}
						/>
					)}
					<IconButtonWithTooltip
						aria-label="Remove pipeline"
						icon={<LuTrash2 />}
						tooltip="Remove pipeline"
						size="sm"
						variant="ghost"
						colorPalette="red"
						onClick={(e: MouseEvent<HTMLButtonElement>) => {
							e.stopPropagation();
							onRemove();
						}}
					/>
				</Group>
			</Group>

			<Collapse in={isOpen}>
				<Stack pt="md" gap="md">
					<Group gap="lg" wrap="wrap">
						<FormInput name={`pipelines.${index}.name`} label="Name" placeholder="Pipeline name" />
						<FormCheckbox name={`pipelines.${index}.enabled`} label="Enabled" />
					</Group>

					<Stack gap="sm">
						<Text fw={600}>Steps</Text>
						{stepFields.map((s, stepIndex) => (
							<Paper key={(s as any)._key} withBorder radius="md" p="sm">
								<Group justify="space-between" wrap="nowrap">
									<Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
										<Badge variant="light">{String((s as any).stepType ?? `step#${stepIndex}`)}</Badge>
										<Text truncate>{String((s as any).stepName ?? '')}</Text>
									</Group>
									<FormCheckbox name={`pipelines.${index}.steps.${stepIndex}.enabled`} label="Enabled" />
								</Group>

								<Group mt="sm" wrap="wrap">
									<FormInput
										name={`pipelines.${index}.steps.${stepIndex}.stepName`}
										label="stepName"
										placeholder="step name"
									/>
								</Group>

								<FormTextarea
									name={`pipelines.${index}.steps.${stepIndex}.paramsJson`}
									label="params (JSON)"
									placeholder="{\n  \n}"
									textareaProps={{ minRows: 6, autosize: true }}
								/>
							</Paper>
						))}
					</Stack>
				</Stack>
			</Collapse>
		</Paper>
	);
};

