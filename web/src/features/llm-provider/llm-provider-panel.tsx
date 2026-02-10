import { Divider, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { llmProviderModel } from '@model/provider';
import { toaster } from '@ui/toaster';

import { LlmPresetManager } from './llm-preset-manager';
import { LlmProviderAdvancedConfig } from './llm-provider-advanced-config';
import { LlmRuntimeSelector } from './llm-runtime-selector';

import type { LlmPresetPayload, LlmProviderConfig, LlmScope } from '@shared/types/llm';

type Props = {
	scope: LlmScope;
	scopeId: string;
	showRuntime?: boolean;
	showConfig?: boolean;
	showPresets?: boolean;
};

export const LlmProviderPanel: React.FC<Props> = ({
	scope,
	scopeId,
	showRuntime = true,
	showConfig = true,
	showPresets = true,
}) => {
	const { t } = useTranslation();
	const [
		providers,
		runtimeByKey,
		tokensByProvider,
		modelsByKey,
		configByProvider,
		presets,
		presetSettings,
		mounted,
		selectProvider,
		selectToken,
		selectModel,
		openTokenManager,
		loadModelsFx,
		loadProviderConfigFx,
		patchProviderConfigFx,
		createLlmPresetFx,
		updateLlmPresetFx,
		deleteLlmPresetFx,
		applyLlmPresetFx,
		patchLlmPresetSettingsFx,
	] = useUnit([
		llmProviderModel.$providers,
		llmProviderModel.$runtimeByScopeKey,
		llmProviderModel.$tokensByProviderId,
		llmProviderModel.$modelsByProviderTokenKey,
		llmProviderModel.$providerConfigById,
		llmProviderModel.$llmPresets,
		llmProviderModel.$llmPresetSettings,
		llmProviderModel.providerPickerMounted,
		llmProviderModel.providerSelected,
		llmProviderModel.tokenSelected,
		llmProviderModel.modelSelected,
		llmProviderModel.tokenManagerOpened,
		llmProviderModel.loadModelsFx,
		llmProviderModel.loadProviderConfigFx,
		llmProviderModel.patchProviderConfigFx,
		llmProviderModel.createLlmPresetFx,
		llmProviderModel.updateLlmPresetFx,
		llmProviderModel.deleteLlmPresetFx,
		llmProviderModel.applyLlmPresetFx,
		llmProviderModel.patchLlmPresetSettingsFx,
	]);

	const scopeKey = `${scope}:${scopeId}` as const;
	const runtime = runtimeByKey[scopeKey];
	const activeProviderId = runtime?.activeProviderId ?? 'openrouter';
	const activeTokenId = runtime?.activeTokenId ?? null;
	const activeModel = runtime?.activeModel ?? null;

	useEffect(() => {
		mounted({ scope, scopeId });
	}, [mounted, scope, scopeId]);

	const providerConfig = useMemo<LlmProviderConfig>(
		() => configByProvider[activeProviderId] ?? {},
		[configByProvider, activeProviderId],
	);
	const [configDraft, setConfigDraft] = useState<LlmProviderConfig>({});

	useEffect(() => {
		if (activeProviderId === 'openai_compatible') {
			setConfigDraft({ baseUrl: '', ...providerConfig });
			return;
		}
		setConfigDraft(providerConfig);
	}, [providerConfig, activeProviderId]);

	const saveConfig = async () => {
		try {
			await patchProviderConfigFx({ providerId: activeProviderId, config: configDraft });
			await loadProviderConfigFx(activeProviderId);
			toaster.success({ title: t('provider.toasts.configSaved') });
		} catch (error) {
			toaster.error({
				title: t('provider.toasts.configSaveFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const tokens = tokensByProvider[activeProviderId] ?? [];
	const modelsKey = `${activeProviderId}:${activeTokenId ?? 'none'}`;
	const models = modelsByKey[modelsKey] ?? [];

	const buildCurrentPayload = (): LlmPresetPayload => ({
		activeProviderId,
		activeModel: activeModel ?? null,
		activeTokenId: activeTokenId ?? null,
		providerConfigsById: {
			openrouter: configByProvider.openrouter ?? {},
			openai_compatible: configByProvider.openai_compatible ?? {},
		},
	});

	return (
		<Stack gap="lg">
			{showRuntime && (
				<LlmRuntimeSelector
					scope={scope}
					scopeId={scopeId}
					providers={providers}
					activeProviderId={activeProviderId}
					tokens={tokens}
					activeTokenId={activeTokenId}
					models={models}
					activeModel={activeModel}
					onProviderSelect={(providerId) => selectProvider({ scope, scopeId, providerId })}
					onTokenSelect={(tokenId) => selectToken({ scope, scopeId, tokenId })}
					onModelSelect={(model) => selectModel({ scope, scopeId, model })}
					onLoadModels={async () => {
						if (!activeTokenId) return;
						await loadModelsFx({
							providerId: activeProviderId,
							scope,
							scopeId,
							tokenId: activeTokenId,
						});
					}}
					onOpenTokenManager={openTokenManager}
				/>
			)}

			{showConfig && (
				<>
					<Divider />
					<LlmProviderAdvancedConfig
						activeProviderId={activeProviderId}
						configDraft={configDraft}
						onChange={setConfigDraft}
						onSave={saveConfig}
					/>
				</>
			)}

			{showPresets && (
				<>
					<Divider />
					<LlmPresetManager
						scope={scope}
						scopeId={scopeId}
						presets={presets}
						presetSettings={presetSettings}
						buildCurrentPayload={buildCurrentPayload}
						onCreatePreset={(params) => createLlmPresetFx(params)}
						onUpdatePreset={(params) => updateLlmPresetFx(params)}
						onDeletePreset={(presetId) => deleteLlmPresetFx(presetId)}
						onApplyPreset={(params) => applyLlmPresetFx(params)}
						onPatchSettings={(params) => patchLlmPresetSettingsFx(params)}
					/>
				</>
			)}
		</Stack>
	);
};
