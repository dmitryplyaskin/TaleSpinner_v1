import { Divider, Select, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';

import { getLlmSettingsFields } from '@model/llm-settings';
import { llmProviderModel } from '@model/provider';
import { samplersModel } from '@model/samplers';
import { FormCheckbox, FormMultiSelect, FormNumberInput, FormSelect, FormTextarea } from '@ui/form-components';
import { LlmRuntimeSelectorFields } from '../../../../../../llm-provider/runtime-selector-fields';
import { SamplerSettingsGrid } from '../../../../../../llm-provider/sampler-settings-grid';

import type { LlmOperationSamplers } from '@shared/types/operation-profiles';
import type { LlmProviderId } from '@shared/types/llm';
import type { SamplersItemType } from '@shared/types/samplers';

type Props = {
	index: number;
};

const RETRY_ON_OPTIONS = [
	{ value: 'timeout', labelKey: 'operationProfiles.kindSection.llm.retryOn.timeout' },
	{ value: 'provider_error', labelKey: 'operationProfiles.kindSection.llm.retryOn.providerError' },
	{ value: 'rate_limit', labelKey: 'operationProfiles.kindSection.llm.retryOn.rateLimit' },
] as const;

type SelectOption = { value: string; label: string };

function toSafeOption(value: unknown, label: unknown): SelectOption | null {
	if (typeof value !== 'string' || value.length === 0) return null;
	return {
		value,
		label: typeof label === 'string' && label.length > 0 ? label : value,
	};
}

function normalizeProviderId(value: unknown): LlmProviderId {
	return value === 'openai_compatible' ? 'openai_compatible' : 'openrouter';
}

function toOperationSamplers(settings: unknown): LlmOperationSamplers {
	if (!settings || typeof settings !== 'object') return {};
	const source = settings as Record<string, unknown>;
	const out: LlmOperationSamplers = {};
	if (typeof source.temperature === 'number' && Number.isFinite(source.temperature)) out.temperature = source.temperature;
	if (typeof source.topP === 'number' && Number.isFinite(source.topP)) out.topP = source.topP;
	if (typeof source.topK === 'number' && Number.isFinite(source.topK)) out.topK = source.topK;
	if (typeof source.frequencyPenalty === 'number' && Number.isFinite(source.frequencyPenalty)) out.frequencyPenalty = source.frequencyPenalty;
	if (typeof source.presencePenalty === 'number' && Number.isFinite(source.presencePenalty)) out.presencePenalty = source.presencePenalty;
	if (typeof source.seed === 'number' && Number.isFinite(source.seed)) out.seed = source.seed;
	if (typeof source.maxTokens === 'number' && Number.isFinite(source.maxTokens)) out.maxTokens = source.maxTokens;
	return out;
}

export const LlmKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	const { control, setValue } = useFormContext();
	const [
		providers,
		tokensByProvider,
		modelsByProviderToken,
		loadProvidersFx,
		loadTokensFx,
		loadModelsFx,
		samplerPresets,
	] = useUnit([
		llmProviderModel.$providers,
		llmProviderModel.$tokensByProviderId,
		llmProviderModel.$modelsByProviderTokenKey,
		llmProviderModel.loadProvidersFx,
		llmProviderModel.loadTokensFx,
		llmProviderModel.loadModelsFx,
		samplersModel.$items,
	]);

	const llmSettingsFields = getLlmSettingsFields(t);
	const providerPath = `operations.${index}.config.params.providerId` as const;
	const tokenPath = `operations.${index}.config.params.credentialRef` as const;
	const modelPath = `operations.${index}.config.params.model` as const;
	const samplerPresetPath = `operations.${index}.config.params.samplerPresetId` as const;
	const samplersPath = `operations.${index}.config.params.samplers` as const;
	const retryPath = `operations.${index}.config.params.retry.retryOn` as const;

	const rawProviderId = useWatch({ control, name: providerPath }) as unknown;
	const activeProviderId = normalizeProviderId(rawProviderId);
	const credentialRef = useWatch({ control, name: tokenPath }) as unknown;
	const activeTokenId = typeof credentialRef === 'string' && credentialRef.length > 0 ? credentialRef : null;
	const rawModel = useWatch({ control, name: modelPath }) as unknown;
	const activeModel = typeof rawModel === 'string' && rawModel.length > 0 ? rawModel : null;
	const rawSamplerPresetId = useWatch({ control, name: samplerPresetPath }) as unknown;
	const samplerPresetId = typeof rawSamplerPresetId === 'string' ? rawSamplerPresetId : '';

	const tokens = tokensByProvider[activeProviderId] ?? [];
	const modelsKey = `${activeProviderId}:${activeTokenId ?? 'none'}`;
	const models = modelsByProviderToken[modelsKey] ?? [];

	const samplerOptions = useMemo(
		() =>
			(samplerPresets as SamplersItemType[])
				.map((item) => toSafeOption(item?.id, item?.name))
				.filter((item): item is SelectOption => item !== null),
		[samplerPresets],
	);

	useEffect(() => {
		void loadProvidersFx();
	}, [loadProvidersFx]);

	useEffect(() => {
		void loadTokensFx(activeProviderId);
	}, [activeProviderId, loadTokensFx]);

	const loadModels = async () => {
		if (!activeTokenId) return;
		await loadModelsFx({
			providerId: activeProviderId,
			scope: 'global',
			scopeId: 'global',
			tokenId: activeTokenId,
		});
	};

	const retryOnOptions: SelectOption[] = RETRY_ON_OPTIONS.map((item) => toSafeOption(item.value, t(item.labelKey))).filter(
		(item): item is SelectOption => item !== null,
	);

	return (
		<Stack gap="md">
			<Text size="sm" c="dimmed">
				{t('operationProfiles.kindSection.llm.description')}
			</Text>

			<Stack gap="xs">
				<Text fw={600}>{t('operationProfiles.kindSection.llm.blocks.prompt')}</Text>
				<FormCheckbox
					name={`operations.${index}.config.params.strictVariables`}
					label={t('operationProfiles.kindSection.llm.strictVariables')}
					infoTip={t('operationProfiles.kindSection.llm.strictVariablesInfo')}
				/>
				<FormTextarea
					name={`operations.${index}.config.params.system`}
					label={t('operationProfiles.kindSection.llm.system')}
					infoTip={t('operationProfiles.kindSection.llm.systemInfo')}
					textareaProps={{ minRows: 3, autosize: true }}
				/>
				<FormTextarea
					name={`operations.${index}.config.params.prompt`}
					label={t('operationProfiles.kindSection.llm.prompt')}
					infoTip={t('operationProfiles.kindSection.llm.promptInfo')}
					textareaProps={{ minRows: 6, autosize: true }}
				/>
			</Stack>

			<Divider />

			<Stack gap="xs">
				<Text fw={600}>{t('operationProfiles.kindSection.llm.blocks.provider')}</Text>
				<LlmRuntimeSelectorFields
					providers={providers}
					activeProviderId={activeProviderId}
					tokens={tokens}
					activeTokenId={activeTokenId}
					models={models}
					activeModel={activeModel}
					onProviderSelect={(providerId) => {
						setValue(providerPath, providerId, { shouldDirty: true });
						setValue(tokenPath, '', { shouldDirty: true });
						setValue(modelPath, '', { shouldDirty: true });
					}}
					onTokenSelect={(tokenId) => {
						setValue(tokenPath, tokenId ?? '', { shouldDirty: true });
						setValue(modelPath, '', { shouldDirty: true });
					}}
					onModelSelect={(model) => {
						setValue(modelPath, model ?? '', { shouldDirty: true });
					}}
					onLoadModels={loadModels}
					allowTokenManager={false}
				/>
			</Stack>

			<Divider />

			<Stack gap="xs">
				<Text fw={600}>{t('operationProfiles.kindSection.llm.blocks.samplers')}</Text>
				<Select
					label={t('operationProfiles.kindSection.llm.samplerPreset')}
					description={t('operationProfiles.kindSection.llm.samplerPresetInfo')}
					data={samplerOptions}
					value={samplerPresetId}
					onChange={(next) => {
						const presetId = next ?? '';
						setValue(samplerPresetPath, presetId, { shouldDirty: true });
						const preset = (samplerPresets as SamplersItemType[]).find((item) => item.id === presetId);
						if (!preset) return;
						setValue(samplersPath, toOperationSamplers(preset.settings), { shouldDirty: true });
					}}
					clearable
					searchable
					comboboxProps={{ withinPortal: false }}
				/>
				<SamplerSettingsGrid
					control={control}
					fields={llmSettingsFields}
					fieldPrefix={`operations.${index}.config.params.samplers`}
				/>
			</Stack>

			<Divider />

			<Stack gap="xs">
				<Text fw={600}>{t('operationProfiles.kindSection.llm.blocks.reliability')}</Text>
				<FormSelect
					name={`operations.${index}.config.params.outputMode`}
					label={t('operationProfiles.kindSection.llm.outputMode')}
					infoTip={t('operationProfiles.kindSection.llm.outputModeInfo')}
					selectProps={{
						comboboxProps: { withinPortal: false },
						options: [
							{ value: 'text', label: t('operationProfiles.kindSection.llm.outputModeText') },
							{ value: 'json', label: t('operationProfiles.kindSection.llm.outputModeJson') },
						],
					}}
				/>
				<FormNumberInput
					name={`operations.${index}.config.params.timeoutMs`}
					label={t('operationProfiles.kindSection.llm.timeoutMs')}
					infoTip={t('operationProfiles.kindSection.llm.timeoutMsInfo')}
					numberInputProps={{ min: 1, step: 1000 }}
				/>
				<FormNumberInput
					name={`operations.${index}.config.params.retry.maxAttempts`}
					label={t('operationProfiles.kindSection.llm.retryMaxAttempts')}
					infoTip={t('operationProfiles.kindSection.llm.retryMaxAttemptsInfo')}
					numberInputProps={{ min: 1, max: 10, step: 1 }}
				/>
				<FormNumberInput
					name={`operations.${index}.config.params.retry.backoffMs`}
					label={t('operationProfiles.kindSection.llm.retryBackoffMs')}
					infoTip={t('operationProfiles.kindSection.llm.retryBackoffMsInfo')}
					numberInputProps={{ min: 0, step: 100 }}
				/>
				<FormMultiSelect
					name={retryPath}
					label={t('operationProfiles.kindSection.llm.retryOn.label')}
					infoTip={t('operationProfiles.kindSection.llm.retryOnInfo')}
					multiSelectProps={{
						options: retryOnOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
			</Stack>
		</Stack>
	);
};
