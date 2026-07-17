import { Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { llmProviderModel } from '@model/provider';
import { samplersModel } from '@model/samplers';

import {
	applyLlmPresetToOperationRuntime,
	buildOperationLlmRuntimeSummary,
	setOperationSamplersEnabled,
	type OperationLlmRuntimeFields,
	type OperationSamplerFields,
} from '../../../../../form/operation-llm-form-utils';

import { OperationLlmRuntimeDialog } from './operation-llm-runtime-dialog';
import { OperationSamplerDialog } from './operation-sampler-dialog';

import type { OperationProfileFormValues } from '../../../../../form/operation-profile-form-mapping';
import type { SamplersItemType } from '@shared/types/samplers';

type Props = {
	index: number;
};

export const OperationLlmConfigControls: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	const { control, setValue } = useFormContext<OperationProfileFormValues>();
	const [isRuntimeDialogOpen, setRuntimeDialogOpen] = useState(false);
	const [isSamplerDialogOpen, setSamplerDialogOpen] = useState(false);
	const [
		providers,
		tokensByProviderId,
		modelsByProviderTokenKey,
		presets,
		samplerPresets,
		ensureProvidersFx,
		ensureTokensFx,
		loadModelsFx,
		ensureModelsFx,
		ensureLlmPresetsFx,
		createLlmPresetFx,
		updateLlmPresetFx,
		deleteLlmPresetFx,
		isLoadingModels,
		isEnsuringModels,
	] = useUnit([
		llmProviderModel.$providers,
		llmProviderModel.$tokensByProviderId,
		llmProviderModel.$modelsByProviderTokenKey,
		llmProviderModel.$llmPresets,
		samplersModel.$items,
		llmProviderModel.ensureProvidersFx,
		llmProviderModel.ensureTokensFx,
		llmProviderModel.loadModelsFx,
		llmProviderModel.ensureModelsFx,
		llmProviderModel.ensureLlmPresetsFx,
		llmProviderModel.createLlmPresetFx,
		llmProviderModel.updateLlmPresetFx,
		llmProviderModel.deleteLlmPresetFx,
		llmProviderModel.loadModelsFx.pending,
		llmProviderModel.ensureModelsFx.pending,
	]);

	const fieldPrefix = `operations.${index}.config.params` as const;
	const providerId = (useWatch({ control, name: `${fieldPrefix}.providerId` }) as OperationLlmRuntimeFields['providerId']) ?? 'openrouter';
	const credentialRef = (useWatch({ control, name: `${fieldPrefix}.credentialRef` }) as string) ?? '';
	const model = (useWatch({ control, name: `${fieldPrefix}.model` }) as string) ?? '';
	const llmPresetId = (useWatch({ control, name: `${fieldPrefix}.llmPresetId` }) as string) ?? '';
	const samplersEnabled = Boolean(useWatch({ control, name: `${fieldPrefix}.samplersEnabled` }) as boolean | undefined);
	const samplerPresetId = (useWatch({ control, name: `${fieldPrefix}.samplerPresetId` }) as string) ?? '';
	const samplers = (useWatch({ control, name: `${fieldPrefix}.samplers` }) as OperationSamplerFields['samplers']) ?? {};

	const runtime: OperationLlmRuntimeFields = {
		providerId,
		credentialRef,
		model,
		llmPresetId,
	};
	const samplerFields: OperationSamplerFields = {
		samplersEnabled,
		samplerPresetId,
		samplers,
	};

	const tokens = tokensByProviderId[providerId] ?? [];
	const models = modelsByProviderTokenKey[`${providerId}:${credentialRef || 'none'}`] ?? [];
	const runtimeSummary = buildOperationLlmRuntimeSummary({
		providers,
		tokens,
		providerId,
		credentialRef,
		model,
	});
	const presetOptions = useMemo(
		() => presets.map((item) => ({ value: item.presetId, label: item.name })),
		[presets],
	);

	useEffect(() => {
		void ensureProvidersFx();
		void ensureLlmPresetsFx();
	}, [ensureLlmPresetsFx, ensureProvidersFx]);

	useEffect(() => {
		void ensureTokensFx(providerId);
	}, [ensureTokensFx, providerId]);

	useEffect(() => {
		if (!credentialRef) return;
		void ensureModelsFx({
			providerId,
			scope: 'global',
			scopeId: 'global',
			tokenId: credentialRef,
		});
	}, [credentialRef, ensureModelsFx, providerId]);

	const patchRuntime = (patch: Partial<OperationLlmRuntimeFields>) => {
		if (typeof patch.providerId !== 'undefined') {
			setValue(`${fieldPrefix}.providerId`, patch.providerId, { shouldDirty: true });
		}
		if (typeof patch.credentialRef !== 'undefined') {
			setValue(`${fieldPrefix}.credentialRef`, patch.credentialRef, { shouldDirty: true });
		}
		if (typeof patch.model !== 'undefined') {
			setValue(`${fieldPrefix}.model`, patch.model, { shouldDirty: true });
		}
		if (typeof patch.llmPresetId !== 'undefined') {
			setValue(`${fieldPrefix}.llmPresetId`, patch.llmPresetId, { shouldDirty: true });
		}
	};

	const patchSamplerFields = (patch: Partial<OperationSamplerFields>) => {
		if (typeof patch.samplersEnabled !== 'undefined') {
			setValue(`${fieldPrefix}.samplersEnabled`, patch.samplersEnabled, { shouldDirty: true });
		}
		if (typeof patch.samplerPresetId !== 'undefined') {
			setValue(`${fieldPrefix}.samplerPresetId`, patch.samplerPresetId, { shouldDirty: true });
		}
		if (typeof patch.samplers !== 'undefined') {
			setValue(`${fieldPrefix}.samplers`, patch.samplers, { shouldDirty: true });
		}
	};

	return (
		<>
			<Stack gap="xs">
				<Select
					label={t('operationProfiles.llmRuntime.preset')}
					description={t('operationProfiles.llmRuntime.presetInfo')}
					data={presetOptions}
					value={llmPresetId || null}
					onChange={(nextValue) => {
						if (!nextValue) {
							patchRuntime({ llmPresetId: '' });
							return;
						}
						const preset = presets.find((item) => item.presetId === nextValue);
						if (!preset) return;
						patchRuntime(applyLlmPresetToOperationRuntime(runtime, { presetId: preset.presetId, payload: preset.payload }));
					}}
					clearable
					searchable
					comboboxProps={{ withinPortal: false }}
				/>

				<Group align="center" justify="space-between" wrap="wrap">
					<Stack gap={2}>
						<Text size="sm" fw={600}>
							{t('operationProfiles.llmRuntime.summaryLabel')}
						</Text>
						<Text size="sm" c="dimmed">
							{runtimeSummary || t('operationProfiles.llmRuntime.notConfigured')}
						</Text>
					</Stack>
					<Button variant="light" onClick={() => setRuntimeDialogOpen(true)}>
						{t('operationProfiles.llmRuntime.configure')}
					</Button>
				</Group>

				<Group align="center" justify="space-between" wrap="wrap">
					<Checkbox
						label={t('operationProfiles.samplers.enabled')}
						checked={samplersEnabled}
						onChange={(event) => {
							patchSamplerFields(setOperationSamplersEnabled(samplerFields, event.currentTarget.checked));
						}}
					/>
					<Button variant="light" onClick={() => setSamplerDialogOpen(true)} disabled={!samplersEnabled}>
						{t('operationProfiles.samplers.configure')}
					</Button>
				</Group>
			</Stack>

			<OperationLlmRuntimeDialog
				open={isRuntimeDialogOpen}
				onOpenChange={setRuntimeDialogOpen}
				providers={providers}
				tokens={tokens}
				models={models}
				isLoadingModels={isLoadingModels || isEnsuringModels}
				presets={presets}
				runtime={runtime}
				onRuntimeChange={patchRuntime}
				onPresetSelect={(presetId) => {
					if (!presetId) {
						patchRuntime({ llmPresetId: '' });
						return;
					}
					const preset = presets.find((item) => item.presetId === presetId);
					if (!preset) return;
					patchRuntime(applyLlmPresetToOperationRuntime(runtime, { presetId: preset.presetId, payload: preset.payload }));
				}}
				onLoadModels={async () => {
					await loadModelsFx({
						providerId,
						scope: 'global',
						scopeId: 'global',
						tokenId: credentialRef || null,
					});
				}}
				onCreatePreset={createLlmPresetFx}
				onUpdatePreset={updateLlmPresetFx}
				onDeletePreset={deleteLlmPresetFx}
			/>

			<OperationSamplerDialog
				open={isSamplerDialogOpen}
				onOpenChange={setSamplerDialogOpen}
				control={control}
				fieldPrefix={`${fieldPrefix}.samplers`}
				samplerFields={samplerFields}
				samplerPresets={samplerPresets as SamplersItemType[]}
				onSamplerFieldsChange={patchSamplerFields}
			/>
		</>
	);
};
