import { Group, Select, Stack, Text } from '@mantine/core';
import React from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormInput, FormNumberInput, FormSelect } from '@ui/form-components';

import { makeDefaultArtifactOutput } from '../../../form/operation-profile-form-mapping';

type OutputType = 'artifacts' | 'prompt_time' | 'turn_canonicalization';

const outputTypeOptions = [
	{ value: 'artifacts', label: 'operationProfiles.outputType.artifacts' },
	{ value: 'prompt_time', label: 'operationProfiles.outputType.promptTime' },
	{ value: 'turn_canonicalization', label: 'operationProfiles.outputType.turnCanonicalization' },
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
	{ value: 'append_after_last_user', label: 'operationProfiles.promptTimeKind.appendAfterLastUser' },
	{ value: 'system_update', label: 'operationProfiles.promptTimeKind.systemUpdate' },
	{ value: 'insert_at_depth', label: 'operationProfiles.promptTimeKind.insertAtDepth' },
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
	const { t } = useTranslation();
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
			<Select
				{...outputTypeField}
				label={t('operationProfiles.sectionsLabels.effectType')}
				data={outputTypeOptions.map((o) => ({ ...o, label: t(o.label) }))}
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
				description={t('operationProfiles.tooltips.effectType')}
			/>

			{normalizedType === 'artifacts' && (
				<Stack gap="xs">
					<Group grow wrap="wrap">
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.tag`}
							label={t('operationProfiles.sectionsLabels.artifactTag')}
							infoTip={t('operationProfiles.tooltips.artifactTag')}
						/>
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.persistence`}
							label={t('operationProfiles.sectionsLabels.persistence')}
							infoTip={t('operationProfiles.tooltips.persistence')}
							selectProps={{ options: persistenceOptions, comboboxProps: { withinPortal: false } }}
						/>
					</Group>
					<Group grow wrap="wrap">
						<FormSelect
							name={`operations.${index}.config.params.output.writeArtifact.usage`}
							label={t('operationProfiles.sectionsLabels.usage')}
							infoTip={t('operationProfiles.tooltips.usage')}
							selectProps={{ options: usageOptions, comboboxProps: { withinPortal: false } }}
						/>
						<FormInput
							name={`operations.${index}.config.params.output.writeArtifact.semantics`}
							label={t('operationProfiles.sectionsLabels.semantics')}
							infoTip={t('operationProfiles.tooltips.semantics')}
						/>
					</Group>
				</Stack>
			)}

			{normalizedType === 'prompt_time' && (
				<Stack gap="xs">
					<Select
						{...promptTimeKindField}
						label={t('operationProfiles.sectionsLabels.promptTimeEffect')}
						description={t('operationProfiles.tooltips.promptTimeEffect')}
						data={promptTimeKindOptions.map((o) => ({ ...o, label: t(o.label) }))}
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
								label={t('operationProfiles.sectionsLabels.mode')}
								infoTip={t('operationProfiles.tooltips.mode')}
								selectProps={{ options: systemUpdateModeOptions, comboboxProps: { withinPortal: false } }}
							/>
							<FormInput
								name={`operations.${index}.config.params.output.promptTime.source`}
								label={t('operationProfiles.sectionsLabels.sourceOptional')}
								infoTip={t('operationProfiles.tooltips.sourceOptional')}
							/>
						</Group>
					)}

					{(promptKind === 'append_after_last_user' || promptKind === 'insert_at_depth') && (
						<Group grow wrap="wrap">
							<FormSelect
								name={`operations.${index}.config.params.output.promptTime.role`}
								label={t('operationProfiles.sectionsLabels.role')}
								infoTip={t('operationProfiles.tooltips.role')}
								selectProps={{ options: promptTimeRoleOptions, comboboxProps: { withinPortal: false } }}
							/>
							<FormInput
								name={`operations.${index}.config.params.output.promptTime.source`}
								label={t('operationProfiles.sectionsLabels.sourceOptional')}
								infoTip={t('operationProfiles.tooltips.sourceOptional')}
							/>
						</Group>
					)}

					{promptKind === 'insert_at_depth' && (
						<FormNumberInput
							name={`operations.${index}.config.params.output.promptTime.depthFromEnd`}
							label={t('operationProfiles.sectionsLabels.depthFromEnd')}
							infoTip={t('operationProfiles.tooltips.depthFromEnd')}
							numberInputProps={{ step: 1 }}
						/>
					)}

					<Text size="xs" c="dimmed">
						{t('operationProfiles.outputNotes.promptTimePayloadSource')}
					</Text>
				</Stack>
			)}

			{normalizedType === 'turn_canonicalization' && (
				<Stack gap="xs">
					<FormSelect
						name={`operations.${index}.config.params.output.canonicalization.target`}
						label={t('operationProfiles.sectionsLabels.target')}
						infoTip={t('operationProfiles.tooltips.target')}
						selectProps={{
							options: [
								{ value: 'user', label: 'user' },
								{ value: 'assistant', label: 'assistant' },
							],
							comboboxProps: { withinPortal: false },
						}}
					/>
					<Text size="xs" c="dimmed">
						{t('operationProfiles.outputNotes.turnCanonicalization')}
					</Text>
				</Stack>
			)}
		</Stack>
	);
};

