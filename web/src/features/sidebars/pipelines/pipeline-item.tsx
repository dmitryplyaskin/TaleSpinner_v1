import { ActionIcon, Code, Collapse, Flex, Group, Paper, Stack, Text } from '@mantine/core';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { LuChevronDown, LuChevronUp, LuMoveUp, LuMoveDown, LuTrash2, LuPlay } from 'react-icons/lu';

import { pipelineCompletionsFx } from '@model/llm-orchestration/completions';
import { FormCheckbox } from '@ui/form-components/form-checkbox';
import { FormInput } from '@ui/form-components/form-input';
import { FormSelect } from '@ui/form-components/form-select';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';



type PipelineItemProps = {
	index: number;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	isFirst: boolean;
	isLast: boolean;
	menuPortalTarget: HTMLElement | null;
};

export const PipelineItem: React.FC<PipelineItemProps> = ({
	index,
	onRemove,
	onMoveUp,
	onMoveDown,
	isFirst,
	isLast,
	menuPortalTarget,
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const { watch, getValues } = useFormContext();
	const name = watch(`pipelines.${index}.name`);

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
						{name || `Pipeline ${index + 1}`}
					</Text>
				</Group>
				<Group gap="xs" wrap="nowrap">
					{!isFirst && (
						<IconButtonWithTooltip
							aria-label="Move up"
							icon={<LuMoveUp />}
							tooltip="Move Up"
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
							tooltip="Move Down"
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
						tooltip="Remove Pipeline"
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
					<Flex gap="md">
						<FormInput name={`pipelines.${index}.name`} label="Pipeline Name" placeholder="Enter pipeline name" />
						<FormInput
							name={`pipelines.${index}.tag`}
							label="Pipeline Tag"
							placeholder="Enter pipeline tag"
							fieldProps={{ style: { maxWidth: 140 } }}
							infoTip={
								<Stack p="xs" gap={4} align="flex-start">
									<Text>The tag allows the result of this Pipeline to be used in subsequent Pipelines.</Text>
									<Text>For example:</Text>
									<Code>{`Some Prompt: {{tag}}`}</Code>
								</Stack>
							}
						/>
					</Flex>
					<FormTextarea
						name={`pipelines.${index}.prompt`}
						label="Prompt"
						placeholder="Enter pipeline prompt"
						textareaProps={{ styles: { input: { minHeight: 200 } } }}
					/>
					<Group>
						<FormCheckbox name={`pipelines.${index}.enabled`} label="Enable Pipeline" infoTip="Enable the pipeline" />
						<FormCheckbox
							name={`pipelines.${index}.addToChatHistory`}
							label="Add to Chat History"
							infoTip="Результат будет добавлен в историю чата. Нужно если нужно сохранять результат между сессиями в одном чате."
						/>
					</Group>
					<Group>
						<FormCheckbox
							name={`pipelines.${index}.showToUserInChat`}
							label="Show to User in Chat"
							infoTip="Работает при условии добавления в иторию чата. Результат будет отображен в чате."
						/>
						<FormCheckbox
							name={`pipelines.${index}.addToPrompt`}
							label="Add to Prompt"
							infoTip="Результут будет добавляться в промпт при обычной генерации ответа (не Full pipeline processing)."
						/>
					</Group>
					<Group>
						<FormSelect
							name={`pipelines.${index}.processing`}
							label="Processing"
							infoTip="Порядок вывода результата. Pre-processing - перед сообщением, Post-processing - после сообщения, Generation - генерация сообщения. (Pre-processing и Post-processing работают при условии наличия, иначе ошибка)."
							selectProps={{
								options: [
									{ label: 'Pre-processing', value: 'pre-processing' },
									{ label: 'Generation', value: 'generation' },
									{ label: 'Post-processing', value: 'post-processing' },
								],
								menuPortalTarget,
							}}
						/>
						<FormSelect
							name={`pipelines.${index}.outputType`}
							label="Output type"
							infoTip="Тип вывода результата. Выбор роли под которым будет генерироваться результат. User - сообщение пользователя, Assistant - сообщение бота, System - система."
							selectProps={{
								options: [
									{ label: 'User', value: 'user' },
									{ label: 'Assistant', value: 'assistant' },
									{ label: 'System', value: 'system' },
								],
								menuPortalTarget,
							}}
						/>
					</Group>

					<Group justify="flex-end">
						<ActionIcon
							variant="filled"
							color="green"
							size="lg"
							aria-label="Run pipeline"
							onClick={() => {
								pipelineCompletionsFx({ pipeline: getValues(`pipelines.${index}`) });
							}}
						>
							<LuPlay />
						</ActionIcon>
					</Group>
				</Stack>
			</Collapse>
		</Paper>
	);
};
