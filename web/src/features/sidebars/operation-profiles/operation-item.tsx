import { Card, Divider, Group, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useWatch } from 'react-hook-form';
import { LuTrash2 } from 'react-icons/lu';

import { FormCheckbox, FormInput, FormMultiSelect, FormNumberInput, FormSelect, FormTextarea } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { useOperationDepsOptions } from './operation-deps-options';

type Props = {
	index: number;
	depsKey: number;
	onRemove: () => void;
};

const hookOptions = [
	{ value: 'before_main_llm', label: 'before_main_llm' },
	{ value: 'after_main_llm', label: 'after_main_llm' },
];

const triggerOptions = [
	{ value: 'generate', label: 'generate' },
	{ value: 'regenerate', label: 'regenerate' },
];

const persistenceOptions = [
	{ value: 'persisted', label: 'persisted' },
	{ value: 'run_only', label: 'run_only' },
];

const usageOptions = [
	{ value: 'prompt_only', label: 'prompt_only' },
	{ value: 'ui_only', label: 'ui_only' },
	{ value: 'prompt+ui', label: 'prompt+ui' },
	{ value: 'internal', label: 'internal' },
];

const RequiredInfoTip =
	'Если required=true, операция должна завершиться status="done". Иначе Run не продолжится через барьер для before_main_llm, либо будет помечен как failed для after_main_llm.';
const DependsOnInfoTip =
	'Операция не стартует, пока все dependsOn не завершатся статусом "done". Если зависимость завершилась error/aborted/skipped, эта операция не может стартовать.';
const OrderInfoTip =
	'Порядок commit эффектов: сначала зависимости, затем меньший order раньше; при равенстве — tie-break по operationId. Даже при параллельном execute commit идёт детерминированно.';

const OperationDependsOnField: React.FC<{ index: number; depsKey: number; selfOpId: string }> = ({ index, depsKey, selfOpId }) => {
	const depOptions = useOperationDepsOptions();
	return (
		<FormMultiSelect
			key={`${depsKey}-${index}-dependsOn`}
			name={`operations.${index}.config.dependsOn`}
			label="Зависит от (dependsOn)"
			infoTip={DependsOnInfoTip}
			multiSelectProps={{
				options: depOptions.filter((o) => o.value !== selfOpId),
				comboboxProps: { withinPortal: false },
				placeholder: 'Нет',
				searchable: true,
			}}
		/>
	);
};

export const OperationItem: React.FC<Props> = memo(({ index, depsKey, onRemove }) => {
	const opId = useWatch({ name: `operations.${index}.opId` }) as string | undefined;

	return (
		<Card withBorder>
			<Stack gap="xs">
				<Group justify="space-between" wrap="nowrap" align="flex-end">
					<FormInput
						name={`operations.${index}.name`}
						label="Название операции"
						inputProps={{ style: { flex: 1 } }}
					/>

					<IconButtonWithTooltip
						aria-label="Delete operation"
						tooltip="Удалить"
						icon={<LuTrash2 />}
						colorPalette="red"
						variant="ghost"
						onClick={onRemove}
					/>
				</Group>

				<Text size="xs" c="dimmed">
					opId: {opId}
				</Text>

				<Group grow wrap="wrap">
					<FormCheckbox
						name={`operations.${index}.config.enabled`}
						label="Включена"
						infoTip='Если выключена, операция считается skipped и не коммитит эффекты.'
					/>
					<FormCheckbox
						name={`operations.${index}.config.required`}
						label="Обязательная (required)"
						infoTip={RequiredInfoTip}
					/>
				</Group>

				<Group grow wrap="wrap">
					<FormSelect
						name={`operations.${index}.config.hooks.0`}
						label="Hook"
						infoTip="before_main_llm выполняется до main LLM; after_main_llm — после."
						selectProps={{
							options: hookOptions,
							comboboxProps: { withinPortal: false },
						}}
					/>
					<FormMultiSelect
						key={`${depsKey}-${index}-triggers`}
						name={`operations.${index}.config.triggers`}
						label="Triggers"
						infoTip="generate — новый ход; regenerate — новый вариант ассистента в текущем ходе."
						multiSelectProps={{
							options: triggerOptions,
							comboboxProps: { withinPortal: false },
						}}
					/>
				</Group>

				<Group grow wrap="wrap">
					<FormNumberInput
						name={`operations.${index}.config.order`}
						label="Порядок (order)"
						infoTip={OrderInfoTip}
						numberInputProps={{ min: 0 }}
					/>
					<OperationDependsOnField index={index} depsKey={depsKey} selfOpId={String(opId ?? '')} />
				</Group>

				<Divider />

				<Stack gap="xs">
					<Text fw={600}>Template</Text>
					<FormCheckbox
						name={`operations.${index}.config.params.strictVariables`}
						label="Strict variables"
						infoTip="Если включено, шаблон должен использовать только разрешённые/известные переменные (строгая валидация)."
					/>
					<FormTextarea
						name={`operations.${index}.config.params.template`}
						label="Шаблон (template)"
						infoTip="Текст шаблона операции (kind=template)."
						textareaProps={{ minRows: 4, autosize: true }}
					/>
				</Stack>

				<Divider />

				<Stack gap="xs">
					<Text fw={600}>writeArtifact</Text>
					<Group grow wrap="wrap">
						<FormInput
							name={`operations.${index}.config.params.writeArtifact.tag`}
							label="Tag"
							infoTip="Имя тега без префикса `art.` (например `world_state`)."
						/>
						<FormSelect
							name={`operations.${index}.config.params.writeArtifact.persistence`}
							label="Persistence"
							infoTip="persisted — сохраняется между ходами; run_only — только в рамках текущего Run."
							selectProps={{ options: persistenceOptions, comboboxProps: { withinPortal: false } }}
						/>
					</Group>
					<Group grow wrap="wrap">
						<FormSelect
							name={`operations.${index}.config.params.writeArtifact.usage`}
							label="Usage"
							infoTip="Как артефакт будет использоваться: только в prompt, только в UI, в обоих, или internal."
							selectProps={{ options: usageOptions, comboboxProps: { withinPortal: false } }}
						/>
						<FormInput
							name={`operations.${index}.config.params.writeArtifact.semantics`}
							label="Semantics"
							infoTip='Смысл артефакта: "state", "log/feed", "lore/memory", "intermediate", или произвольная строка.'
						/>
					</Group>
				</Stack>
			</Stack>
		</Card>
	);
});

OperationItem.displayName = 'OperationItem';

