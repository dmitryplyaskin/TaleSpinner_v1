import { Card, Divider, Group, Select, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { LuTrash2 } from 'react-icons/lu';

import { FormCheckbox, FormInput, FormMultiSelect, FormNumberInput, FormSelect, FormTextarea } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { useOperationDepsOptions } from './operation-deps-options';

type Props = {
	index: number;
	depsKey: number;
	onRemove: () => void;
};

const kindOptions = [
	{ value: 'template', label: 'template' },
	{ value: 'llm', label: 'llm' },
	{ value: 'rag', label: 'rag' },
	{ value: 'tool', label: 'tool' },
	{ value: 'compute', label: 'compute' },
	{ value: 'transform', label: 'transform' },
	{ value: 'legacy', label: 'legacy' },
];

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

const outputTypeOptions = [
	{ value: 'artifacts', label: 'Artifacts' },
	{ value: 'prompt_time', label: 'Prompt-time effects' },
	{ value: 'turn_canonicalization', label: 'Turn canonicalization effects' },
];

const promptTimeRoleOptions = [
	{ value: 'system', label: 'system' },
	{ value: 'developer', label: 'developer' },
	{ value: 'user', label: 'user' },
	{ value: 'assistant', label: 'assistant' },
];

const promptTimeKindOptions = [
	{ value: 'append_after_last_user', label: 'prompt.append_after_last_user' },
	{ value: 'system_update', label: 'prompt.system_update' },
	{ value: 'insert_at_depth', label: 'prompt.insert_at_depth' },
];

const systemUpdateModeOptions = [
	{ value: 'prepend', label: 'prepend' },
	{ value: 'append', label: 'append' },
	{ value: 'replace', label: 'replace' },
];

function makeDefaultArtifactsOutput() {
	return {
		type: 'artifacts' as const,
		writeArtifact: {
			tag: `artifact_${Math.random().toString(16).slice(2, 8)}`,
			persistence: 'run_only' as const,
			usage: 'internal' as const,
			semantics: 'intermediate',
		},
	};
}

function makeDefaultPromptTimeOutput() {
	return {
		type: 'prompt_time' as const,
		promptTime: {
			kind: 'append_after_last_user' as const,
			role: 'developer' as const,
			source: 'template_output',
		},
	};
}

function makeDefaultTurnCanonicalizationOutput() {
	return {
		type: 'turn_canonicalization' as const,
		canonicalization: {
			kind: 'replace_text' as const,
			target: 'user' as const,
		},
	};
}

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

const OutputFields: React.FC<{ index: number }> = ({ index }) => {
	const { control, setValue } = useFormContext();

	const {
		field: { value: outputType, onChange: onOutputTypeChange, ...outputTypeField },
	} = useController({
		control,
		name: `operations.${index}.config.params.output.type`,
	});

	const normalizedType =
		outputType === 'artifacts' || outputType === 'prompt_time' || outputType === 'turn_canonicalization'
			? (outputType as string)
			: 'artifacts';

	const {
		field: { value: promptTimeKindValue, onChange: onPromptTimeKindChange, ...promptTimeKindField },
	} = useController({
		control,
		name: `operations.${index}.config.params.output.promptTime.kind`,
	});

	const promptKind =
		promptTimeKindValue === 'append_after_last_user' ||
		promptTimeKindValue === 'system_update' ||
		promptTimeKindValue === 'insert_at_depth'
			? (promptTimeKindValue as string)
			: 'append_after_last_user';

	return (
		<Stack gap="xs">
			<Text fw={600}>Effects / Output</Text>

			<Select
				{...outputTypeField}
				label="Тип эффекта"
				data={outputTypeOptions}
				value={normalizedType}
				onChange={(next) => {
					const nextType = next ?? 'artifacts';
					onOutputTypeChange(nextType);
					if (nextType === 'artifacts') {
						setValue(`operations.${index}.config.params.output`, makeDefaultArtifactsOutput(), { shouldDirty: true });
					}
					if (nextType === 'prompt_time') {
						setValue(`operations.${index}.config.params.output`, makeDefaultPromptTimeOutput(), { shouldDirty: true });
					}
					if (nextType === 'turn_canonicalization') {
						setValue(`operations.${index}.config.params.output`, makeDefaultTurnCanonicalizationOutput(), { shouldDirty: true });
					}
				}}
				comboboxProps={{ withinPortal: false }}
				description="Результат template будет применён как один из эффектов v2 (см. спеку)."
			/>

			{normalizedType === 'artifacts' && (
				<Stack gap="xs">
					<Group grow wrap="wrap">
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.tag`}
							label="Artifact tag"
							infoTip="Имя тега без префикса `art.`. В одном профиле один tag может записывать только одна операция."
						/>
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.persistence`}
							label="Persistence"
							infoTip="persisted — сохраняется между ходами; run_only — только в рамках текущего Run."
							selectProps={{ options: persistenceOptions, comboboxProps: { withinPortal: false } }}
						/>
					</Group>
					<Group grow wrap="wrap">
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.usage`}
							label="Usage"
							infoTip="Как артефакт будет использоваться: только в prompt, только в UI, в обоих, или internal."
							selectProps={{ options: usageOptions, comboboxProps: { withinPortal: false } }}
						/>
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.semantics`}
							label="Semantics"
							infoTip='Смысл артефакта: "state", "log/feed", "lore/memory", "intermediate", или произвольная строка.'
						/>
					</Group>
				</Stack>
			)}

			{normalizedType === 'prompt_time' && (
				<Stack gap="xs">
					<Select
						{...promptTimeKindField}
						label="Prompt-time effect"
						description="Эффект применяется только в before_main_llm и влияет на effective prompt текущего main LLM вызова."
						data={promptTimeKindOptions}
						value={promptKind}
						onChange={(next) => {
							const nextKind = next ?? 'append_after_last_user';
							onPromptTimeKindChange(nextKind);
							if (nextKind === 'system_update') {
								setValue(
									`operations.${index}.config.params.output.promptTime`,
									{ kind: nextKind, mode: 'prepend', source: 'template_output' },
									{ shouldDirty: true },
								);
							}
							if (nextKind === 'append_after_last_user') {
								setValue(
									`operations.${index}.config.params.output.promptTime`,
									{ kind: nextKind, role: 'developer', source: 'template_output' },
									{ shouldDirty: true },
								);
							}
							if (nextKind === 'insert_at_depth') {
								setValue(
									`operations.${index}.config.params.output.promptTime`,
									{ kind: nextKind, depthFromEnd: 0, role: 'developer', source: 'template_output' },
									{ shouldDirty: true },
								);
							}
						}}
						comboboxProps={{ withinPortal: false }}
					/>

					{promptKind === 'system_update' && (
						<Group grow wrap="wrap">
							<FormSelect
								name={`operations.${index}.config.params.output.promptTime.mode`}
								label="Mode"
								infoTip="prepend: payload + system; append: system + payload; replace: system := payload."
								selectProps={{ options: systemUpdateModeOptions, comboboxProps: { withinPortal: false } }}
							/>
							<FormInput
								name={`operations.${index}.config.params.output.promptTime.source`}
								label="Source (optional)"
								infoTip="Опциональная метка источника для дебага/объяснимости."
							/>
						</Group>
					)}

					{(promptKind === 'append_after_last_user' || promptKind === 'insert_at_depth') && (
						<Group grow wrap="wrap">
							<FormSelect
								name={`operations.${index}.config.params.output.promptTime.role`}
								label="Role"
								infoTip="Какой ролью будет вставлено синтетическое сообщение в effective prompt."
								selectProps={{ options: promptTimeRoleOptions, comboboxProps: { withinPortal: false } }}
							/>
							<FormInput
								name={`operations.${index}.config.params.output.promptTime.source`}
								label="Source (optional)"
								infoTip="Опциональная метка источника для дебага/объяснимости."
							/>
						</Group>
					)}

					{promptKind === 'insert_at_depth' && (
						<FormNumberInput
							name={`operations.${index}.config.params.output.promptTime.depthFromEnd`}
							label="depthFromEnd"
							infoTip="0 — вставить в самый конец; -N — вставить на глубину (ближе к концу)."
							numberInputProps={{ step: 1 }}
						/>
					)}

					<Text size="xs" c="dimmed">
						Контент эффекта берётся из результата template (output string).
					</Text>
				</Stack>
			)}

			{normalizedType === 'turn_canonicalization' && (
				<Stack gap="xs">
					<FormSelect
						name={`operations.${index}.config.params.output.canonicalization.target`}
						label="Target"
						infoTip="before_main_llm: можно канонизировать только user; after_main_llm: user и assistant."
						selectProps={{
							options: [
								{ value: 'user', label: 'user' },
								{ value: 'assistant', label: 'assistant' },
							],
							comboboxProps: { withinPortal: false },
						}}
					/>
					<Text size="xs" c="dimmed">
						Пока поддерживаем минимальный режим: replace_text (перезаписать текст выбранной части хода результатом template).
					</Text>
				</Stack>
			)}
		</Stack>
	);
};

export const OperationItem: React.FC<Props> = memo(({ index, depsKey, onRemove }) => {
	const opId = useWatch({ name: `operations.${index}.opId` }) as string | undefined;
	const output = useWatch({ name: `operations.${index}.config.params.output` }) as unknown;
	const { setValue, control } = useFormContext();

	const {
		field: { value: kindValue, onChange: onKindChange, ...kindField },
	} = useController({
		control,
		name: `operations.${index}.kind`,
	});

	const normalizedKind =
		kindValue === 'template' ||
		kindValue === 'llm' ||
		kindValue === 'rag' ||
		kindValue === 'tool' ||
		kindValue === 'compute' ||
		kindValue === 'transform' ||
		kindValue === 'legacy'
			? (kindValue as string)
			: 'template';

	return (
		<Card withBorder>
			<Stack gap="xs">
				<Group justify="space-between" wrap="nowrap" align="flex-end">
					<FormInput name={`operations.${index}.name`} label="Название операции" inputProps={{ style: { flex: 1 } }} />
					<Select
						{...kindField}
						label="kind"
						data={kindOptions}
						value={normalizedKind}
						onChange={(next) => {
							const nextKind = next ?? 'template';
							onKindChange(nextKind);

							const safeOutput =
								output && typeof output === 'object'
									? (output as any)
									: makeDefaultArtifactsOutput();

							if (nextKind === 'template') {
								setValue(
									`operations.${index}.config.params`,
									{ template: '', strictVariables: false, output: safeOutput },
									{ shouldDirty: true },
								);
							} else {
								setValue(
									`operations.${index}.config.params`,
									{ paramsJson: '{\n  \n}', output: safeOutput },
									{ shouldDirty: true },
								);
							}
						}}
						comboboxProps={{ withinPortal: false }}
						description="Тип операции определяет, какие поля params доступны."
						style={{ width: 180 }}
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

				{normalizedKind === 'template' ? (
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
				) : (
					<Stack gap="xs">
						<Text fw={600}>Params</Text>
						<FormTextarea
							name={`operations.${index}.config.params.paramsJson`}
							label="params (JSON)"
							infoTip="Черновой UI: для non-template операций параметры редактируются как JSON-объект. Будет заменено на типизированную форму под конкретный kind."
							textareaProps={{ minRows: 6, autosize: true }}
						/>
					</Stack>
				)}

				<Divider />

				<OutputFields index={index} />
			</Stack>
		</Card>
	);
});

OperationItem.displayName = 'OperationItem';

