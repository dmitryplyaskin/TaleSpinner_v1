import { Accordion, Button, Divider, Select, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { getLlmSettingsFields } from '@model/llm-settings';
import { llmProviderModel } from '@model/provider';
import { samplersModel } from '@model/samplers';
import { Dialog } from '@ui/dialog';
import { FormCheckbox, FormInput, FormMultiSelect, FormNumberInput, FormSelect, FormTextarea } from '@ui/form-components';

import { LlmRuntimeSelectorFields } from '../../../../../../llm-provider/runtime-selector-fields';
import { SamplerSettingsGrid } from '../../../../../../llm-provider/sampler-settings-grid';

import type { LlmProviderId } from '@shared/types/llm';
import type { LlmOperationSamplers } from '@shared/types/operation-profiles';
import type { SamplersItemType } from '@shared/types/samplers';

type Props = {
	index: number;
};

const RETRY_ON_OPTIONS = [
	{ value: 'timeout', labelKey: 'operationProfiles.kindSection.llm.retryOn.timeout' },
	{ value: 'provider_error', labelKey: 'operationProfiles.kindSection.llm.retryOn.providerError' },
	{ value: 'rate_limit', labelKey: 'operationProfiles.kindSection.llm.retryOn.rateLimit' },
] as const;

const JSON_SCHEMA_EXAMPLE = `{
  "report_id": "string: Unique report identifier",
  "created_at": "string: ISO timestamp",
  "status": "string: Processing status",
  "confidence?": "number: Optional confidence score from 0 to 1",
  "summary": {
    "title": "string: Short title",
    "items_count": 0
  },
  "items": [
    {
      "id": "string: Item identifier",
      "label": "string: Item label",
      "score?": "number: Optional score"
    }
  ]
}`;

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
	const [isSchemaHelpOpen, setSchemaHelpOpen] = useState(false);
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
	const outputModePath = `operations.${index}.config.params.outputMode` as const;
	const jsonParseModePath = `operations.${index}.config.params.jsonParseMode` as const;
	const jsonCustomPatternPath = `operations.${index}.config.params.jsonCustomPattern` as const;
	const jsonCustomFlagsPath = `operations.${index}.config.params.jsonCustomFlags` as const;
	const strictSchemaValidationPath = `operations.${index}.config.params.strictSchemaValidation` as const;
	const jsonSchemaTextPath = `operations.${index}.config.params.jsonSchemaText` as const;

	const rawProviderId = useWatch({ control, name: providerPath }) as unknown;
	const activeProviderId = normalizeProviderId(rawProviderId);
	const credentialRef = useWatch({ control, name: tokenPath }) as unknown;
	const activeTokenId = typeof credentialRef === 'string' && credentialRef.length > 0 ? credentialRef : null;
	const rawModel = useWatch({ control, name: modelPath }) as unknown;
	const activeModel = typeof rawModel === 'string' && rawModel.length > 0 ? rawModel : null;
	const rawSamplerPresetId = useWatch({ control, name: samplerPresetPath }) as unknown;
	const samplerPresetId = typeof rawSamplerPresetId === 'string' ? rawSamplerPresetId : '';
	const rawOutputMode = useWatch({ control, name: outputModePath }) as unknown;
	const outputMode = rawOutputMode === 'json' ? 'json' : 'text';
	const rawJsonParseMode = useWatch({ control, name: jsonParseModePath }) as unknown;
	const jsonParseMode =
		rawJsonParseMode === 'markdown_code_block' || rawJsonParseMode === 'custom_regex' ? rawJsonParseMode : 'raw';

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

	const parseModeInfoContent = (
		<Stack gap={4}>
			<Text size="xs">{t('operationProfiles.kindSection.llm.jsonParseModeInfo')}</Text>
			<Text size="xs">`raw`: {t('operationProfiles.kindSection.llm.jsonParseModeHintRaw')}</Text>
			<Text size="xs">
				`markdown_code_block`: {t('operationProfiles.kindSection.llm.jsonParseModeHintMarkdownCodeBlock')}
			</Text>
			<Text size="xs">`custom_regex`: {t('operationProfiles.kindSection.llm.jsonParseModeHintCustomRegex')}</Text>
		</Stack>
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
					textareaProps={{ minRows: 4, maxRows: 12, autosize: false }}
				/>
				<FormTextarea
					name={`operations.${index}.config.params.prompt`}
					label={t('operationProfiles.kindSection.llm.prompt')}
					infoTip={t('operationProfiles.kindSection.llm.promptInfo')}
					textareaProps={{ minRows: 8, maxRows: 20, autosize: false }}
				/>
			</Stack>

			<Divider />

			<Accordion multiple defaultValue={['provider', 'samplers']} variant="contained">
				<Accordion.Item value="provider">
					<Accordion.Control>{t('operationProfiles.kindSection.llm.blocks.provider')}</Accordion.Control>
					<Accordion.Panel>
						<Stack gap="xs">
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
					</Accordion.Panel>
				</Accordion.Item>

				<Accordion.Item value="samplers">
					<Accordion.Control>{t('operationProfiles.kindSection.llm.blocks.samplers')}</Accordion.Control>
					<Accordion.Panel>
						<Stack gap="xs">
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
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion>

			<Divider />

			<Stack gap="xs">
				<Text fw={600}>{t('operationProfiles.kindSection.llm.blocks.reliability')}</Text>
				<FormSelect
					name={outputModePath}
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
				{outputMode === 'json' ? (
					<FormSelect
						name={jsonParseModePath}
						label={t('operationProfiles.kindSection.llm.jsonParseMode')}
						infoTip={parseModeInfoContent}
						selectProps={{
							comboboxProps: { withinPortal: false },
							options: [
								{ value: 'raw', label: t('operationProfiles.kindSection.llm.jsonParseModeRaw') },
								{
									value: 'markdown_code_block',
									label: t('operationProfiles.kindSection.llm.jsonParseModeMarkdownCodeBlock'),
								},
								{ value: 'custom_regex', label: t('operationProfiles.kindSection.llm.jsonParseModeCustomRegex') },
							],
						}}
					/>
				) : null}
				{outputMode === 'json' && jsonParseMode === 'custom_regex' ? (
					<>
						<FormInput
							name={jsonCustomPatternPath}
							label={t('operationProfiles.kindSection.llm.jsonCustomPattern')}
							infoTip={t('operationProfiles.kindSection.llm.jsonCustomPatternInfo')}
						/>
						<FormInput
							name={jsonCustomFlagsPath}
							label={t('operationProfiles.kindSection.llm.jsonCustomFlags')}
							infoTip={t('operationProfiles.kindSection.llm.jsonCustomFlagsInfo')}
						/>
					</>
				) : null}
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
				{outputMode === 'json' ? (
					<>
						<FormCheckbox
							name={strictSchemaValidationPath}
							label={t('operationProfiles.kindSection.llm.strictSchemaValidation')}
							infoTip={t('operationProfiles.kindSection.llm.strictSchemaValidationInfo')}
						/>
						<FormTextarea
							name={jsonSchemaTextPath}
							label={t('operationProfiles.kindSection.llm.jsonSchema')}
							infoTip={t('operationProfiles.kindSection.llm.jsonSchemaInfo')}
							textareaProps={{
								minRows: 10,
								maxRows: 24,
								autosize: false,
								placeholder: JSON_SCHEMA_EXAMPLE,
							}}
						/>
						<Button variant="light" size="xs" onClick={() => setSchemaHelpOpen(true)}>
							{t('operationProfiles.kindSection.llm.schemaHelp.open')}
						</Button>
					</>
				) : null}
			</Stack>

			<Dialog
				open={isSchemaHelpOpen}
				onOpenChange={setSchemaHelpOpen}
				title={t('operationProfiles.kindSection.llm.schemaHelp.title')}
				size="lg"
				footer={
					<Button variant="subtle" onClick={() => setSchemaHelpOpen(false)}>
						{t('common.close')}
					</Button>
				}
			>
				<Stack gap="xs">
					<Text size="sm">{t('operationProfiles.kindSection.llm.schemaHelp.description')}</Text>
					<Text size="sm">1. {t('operationProfiles.kindSection.llm.schemaHelp.ruleTypeDescriptor')}</Text>
					<Text size="sm">2. {t('operationProfiles.kindSection.llm.schemaHelp.ruleOptional')}</Text>
					<Text size="sm">3. {t('operationProfiles.kindSection.llm.schemaHelp.ruleArray')}</Text>
					<Text size="sm">4. {t('operationProfiles.kindSection.llm.schemaHelp.ruleLiterals')}</Text>
					<pre
						style={{
							margin: 0,
							padding: 12,
							borderRadius: 8,
							background: 'var(--mantine-color-gray-0)',
							overflowX: 'auto',
							fontSize: 12,
						}}
					>
						{JSON_SCHEMA_EXAMPLE}
					</pre>
				</Stack>
			</Dialog>
		</Stack>
	);
};
