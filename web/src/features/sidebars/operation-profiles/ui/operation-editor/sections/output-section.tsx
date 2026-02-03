import { Group, Select, Stack, Text } from '@mantine/core';
import React from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { FormInput, FormNumberInput, FormSelect } from '@ui/form-components';

import { makeDefaultArtifactOutput } from '../../../form/operation-profile-form-mapping';

type OutputType = 'artifacts' | 'prompt_time' | 'turn_canonicalization';

const outputTypeOptions = [
	{ value: 'artifacts', label: 'Artifacts' },
	{ value: 'prompt_time', label: 'Prompt-time effects' },
	{ value: 'turn_canonicalization', label: 'Turn canonicalization effects' },
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
	return { type: 'artifacts' as const, writeArtifact: makeDefaultArtifactOutput().writeArtifact };
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

type Props = {
	index: number;
};

export const OutputSection: React.FC<Props> = ({ index }) => {
	const { control, setValue } = useFormContext();

	const {
		field: { value: outputType, onChange: onOutputTypeChange, ...outputTypeField },
	} = useController({
		control,
		name: `operations.${index}.config.params.output.type`,
	});

	const normalizedType: OutputType =
		outputType === 'artifacts' || outputType === 'prompt_time' || outputType === 'turn_canonicalization'
			? outputType
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
			? promptTimeKindValue
			: 'append_after_last_user';

	return (
		<Stack gap="xs">
			<Text fw={600}>Effects / Output</Text>

			<Select
				{...outputTypeField}
				label="Effect type"
				data={outputTypeOptions}
				value={normalizedType}
				onChange={(next) => {
					const nextType: OutputType = (next as OutputType) ?? 'artifacts';
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
				description="Template result will be applied as an effect output (see spec)."
			/>

			{normalizedType === 'artifacts' && (
				<Stack gap="xs">
					<Group grow wrap="wrap">
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.tag`}
							label="Artifact tag"
							infoTip="Tag name without `art.` prefix. Within a profile, a tag can only be written by one operation."
						/>
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.persistence`}
							label="Persistence"
							infoTip="persisted — saved between turns; run_only — only within the current Run."
							selectProps={{ options: persistenceOptions, comboboxProps: { withinPortal: false } }}
						/>
					</Group>
					<Group grow wrap="wrap">
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.usage`}
							label="Usage"
							infoTip="How the artifact is used: prompt only, UI only, both, or internal."
							selectProps={{ options: usageOptions, comboboxProps: { withinPortal: false } }}
						/>
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.semantics`}
							label="Semantics"
							infoTip='Semantic meaning: "state", "log/feed", "lore/memory", "intermediate", or a custom string.'
						/>
					</Group>
				</Stack>
			)}

			{normalizedType === 'prompt_time' && (
				<Stack gap="xs">
					<Select
						{...promptTimeKindField}
						label="Prompt-time effect"
						description="Applied only in before_main_llm and affects the effective prompt of the main LLM call."
						data={promptTimeKindOptions}
						value={promptKind}
						onChange={(next) => {
							const nextKind = (next as typeof promptTimeKindOptions[number]['value']) ?? 'append_after_last_user';
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
								infoTip="Optional source label for debugging/explainability."
							/>
						</Group>
					)}

					{(promptKind === 'append_after_last_user' || promptKind === 'insert_at_depth') && (
						<Group grow wrap="wrap">
							<FormSelect
								name={`operations.${index}.config.params.output.promptTime.role`}
								label="Role"
								infoTip="Role of the synthetic message inserted into the effective prompt."
								selectProps={{ options: promptTimeRoleOptions, comboboxProps: { withinPortal: false } }}
							/>
							<FormInput
								name={`operations.${index}.config.params.output.promptTime.source`}
								label="Source (optional)"
								infoTip="Optional source label for debugging/explainability."
							/>
						</Group>
					)}

					{promptKind === 'insert_at_depth' && (
						<FormNumberInput
							name={`operations.${index}.config.params.output.promptTime.depthFromEnd`}
							label="depthFromEnd"
							infoTip="0 — insert at the very end; -N — insert at depth (closer to the end)."
							numberInputProps={{ step: 1 }}
						/>
					)}

					<Text size="xs" c="dimmed">
						Effect content comes from template output (string).
					</Text>
				</Stack>
			)}

			{normalizedType === 'turn_canonicalization' && (
				<Stack gap="xs">
					<FormSelect
						name={`operations.${index}.config.params.output.canonicalization.target`}
						label="Target"
						infoTip="before_main_llm: only user; after_main_llm: user or assistant."
						selectProps={{
							options: [
								{ value: 'user', label: 'user' },
								{ value: 'assistant', label: 'assistant' },
							],
							comboboxProps: { withinPortal: false },
						}}
					/>
					<Text size="xs" c="dimmed">
						Minimal mode for now: replace_text (overwrite selected turn part with template result).
					</Text>
				</Stack>
			)}
		</Stack>
	);
};

