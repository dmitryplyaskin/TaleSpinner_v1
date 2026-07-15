import { Alert, Button, Divider, Group, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuRotateCcw } from 'react-icons/lu';

import { llmProviderModel } from '@model/provider';
import { toaster } from '@ui/toaster';

import { LlmConnectionEditor } from './llm-connection-editor';
import { LlmDisclosureSection } from './llm-disclosure-section';
import { LlmPresetManager } from './llm-preset-manager';
import { LlmProviderAdvancedConfig } from './llm-provider-advanced-config';
import { createProviderDraft, normalizeProviderConfig, type ProviderConnectionDraft } from './llm-provider-draft';
import { OpenRouterRoutingEditor } from './openrouter-routing-editor';

import type {
	LlmPresetPayload,
	LlmProviderConfig,
	LlmProviderConnectionCheckResult,
	LlmRuntime,
	LlmScope,
} from '@shared/types/llm';

type Props = { scope: LlmScope; scopeId: string };

function toDraft(runtime: LlmRuntime, config?: LlmProviderConfig): ProviderConnectionDraft {
	return {
		providerId: runtime.activeProviderId,
		tokenId: runtime.activeTokenId,
		modelId: runtime.activeModel,
		config: normalizeProviderConfig(runtime.activeProviderId, config),
	};
}

export const LlmProviderPanel: React.FC<Props> = ({ scope, scopeId }) => {
	const { t } = useTranslation();
	const [
		providers,
		runtimeByKey,
		tokensByProvider,
		modelsByKey,
		endpointsByModel,
		configs,
		presets,
		presetSettings,
		mount,
		loadTokensFx,
		loadConfigFx,
		loadProviderStateFx,
		loadModelsFx,
		loadEndpointsFx,
		checkConnectionFx,
		saveConnectionFx,
		createPresetFx,
		updatePresetFx,
		deletePresetFx,
		applyPresetFx,
		patchPresetSettingsFx,
		isLoadingModels,
		isLoadingEndpoints,
		isChecking,
		isSaving,
	] = useUnit([
		llmProviderModel.$providers,
		llmProviderModel.$runtimeByScopeKey,
		llmProviderModel.$tokensByProviderId,
		llmProviderModel.$modelsByProviderTokenKey,
		llmProviderModel.$openRouterEndpointsByModel,
		llmProviderModel.$providerConfigById,
		llmProviderModel.$llmPresets,
		llmProviderModel.$llmPresetSettings,
		llmProviderModel.providerPickerMounted,
		llmProviderModel.loadTokensFx,
		llmProviderModel.loadProviderConfigFx,
		llmProviderModel.loadRuntimeProviderStateFx,
		llmProviderModel.loadModelsFx,
		llmProviderModel.loadOpenRouterEndpointsFx,
		llmProviderModel.checkProviderConnectionFx,
		llmProviderModel.saveConnectionFx,
		llmProviderModel.createLlmPresetFx,
		llmProviderModel.updateLlmPresetFx,
		llmProviderModel.deleteLlmPresetFx,
		llmProviderModel.applyLlmPresetFx,
		llmProviderModel.patchLlmPresetSettingsFx,
		llmProviderModel.loadModelsFx.pending,
		llmProviderModel.loadOpenRouterEndpointsFx.pending,
		llmProviderModel.checkProviderConnectionFx.pending,
		llmProviderModel.saveConnectionFx.pending,
	]);

	const form = useForm<ProviderConnectionDraft>({
		defaultValues: {
			providerId: 'openrouter',
			tokenId: null,
			modelId: null,
			config: normalizeProviderConfig('openrouter'),
		},
	});
	const { control, formState, getValues, reset, setValue } = form;
	const providerId = useWatch({ control, name: 'providerId' });
	const tokenId = useWatch({ control, name: 'tokenId' });
	const modelId = useWatch({ control, name: 'modelId' });
	const config = useWatch({ control, name: 'config' });
	const runtime = runtimeByKey[`${scope}:${scopeId}`];
	const initializedSignature = useRef('');
	const draftsByProvider = useRef<Partial<Record<ProviderConnectionDraft['providerId'], ProviderConnectionDraft>>>({});
	const [connectionResult, setConnectionResult] = useState<LlmProviderConnectionCheckResult | null>(null);

	useEffect(() => {
		mount({ scope, scopeId });
	}, [mount, scope, scopeId]);
	useEffect(() => {
		if (!runtime) return;
		const runtimeConfig = configs[runtime.activeProviderId];
		const signature = JSON.stringify([runtime, runtimeConfig ?? null]);
		if (signature === initializedSignature.current) return;
		initializedSignature.current = signature;
		const draft = toDraft(runtime, runtimeConfig);
		draftsByProvider.current[runtime.activeProviderId] = draft;
		reset(draft);
		if (runtime.activeProviderId === 'openrouter' && runtime.activeModel) void loadEndpointsFx(runtime.activeModel);
	}, [configs, loadEndpointsFx, reset, runtime]);

	useEffect(() => setConnectionResult(null), [config, modelId, providerId, tokenId]);

	const tokens = tokensByProvider[providerId] ?? [];
	const models = modelsByKey[`${providerId}:${tokenId ?? 'none'}`] ?? [];
	const endpoints = modelId ? (endpointsByModel[modelId] ?? []) : [];
	const activePresetId = presetSettings?.activePresetId ?? null;
	const refreshEndpoints = async (nextModelId: string) => {
		try {
			await loadEndpointsFx(nextModelId);
		} catch {
			toaster.warning({ title: t('provider.toasts.endpointsLoadFailed') });
		}
	};

	const buildPayload = (draft = getValues()): LlmPresetPayload => ({
		activeProviderId: draft.providerId,
		activeTokenId: draft.tokenId,
		activeModel: draft.modelId,
		providerConfigsById: {
			openrouter: draft.providerId === 'openrouter' ? draft.config : (configs.openrouter ?? {}),
			openai_compatible: draft.providerId === 'openai_compatible' ? draft.config : (configs.openai_compatible ?? {}),
		},
	});

	const refreshModels = async () => {
		if (!tokenId) return;
		const result = await loadModelsFx({ providerId, scope, scopeId, tokenId });
		if (result.models.length === 0) toaster.warning({ title: t('provider.toasts.modelsEmpty') });
	};

	const changeProvider = async (nextProviderId: ProviderConnectionDraft['providerId']) => {
		draftsByProvider.current[providerId] = getValues();
		const cached = draftsByProvider.current[nextProviderId];
		const [loadedConfig, providerState] = await Promise.all([
			loadConfigFx(nextProviderId),
			loadProviderStateFx({ scope, scopeId, providerId: nextProviderId }),
			loadTokensFx(nextProviderId),
		]);
		const nextDraft = cached ?? createProviderDraft(nextProviderId, loadedConfig.config, providerState);
		draftsByProvider.current[nextProviderId] = nextDraft;
		setValue('providerId', nextProviderId, { shouldDirty: true });
		setValue('tokenId', nextDraft.tokenId, { shouldDirty: true });
		setValue('modelId', nextDraft.modelId, { shouldDirty: true });
		setValue('config', nextDraft.config, { shouldDirty: true });
		if (nextDraft.tokenId) {
			await loadModelsFx({ providerId: nextProviderId, scope, scopeId, tokenId: nextDraft.tokenId });
		}
	};

	const changeToken = async (nextTokenId: string | null) => {
		setValue('tokenId', nextTokenId, { shouldDirty: true });
		if (nextTokenId) await loadModelsFx({ providerId, scope, scopeId, tokenId: nextTokenId });
	};

	const changeModel = async (nextModelId: string) => {
		setValue('modelId', nextModelId, { shouldDirty: true });
		if (providerId === 'openrouter') await refreshEndpoints(nextModelId);
	};

	const validateDraft = (draft: ProviderConnectionDraft): boolean => {
		if (!draft.tokenId || !draft.modelId) return false;
		const routing = draft.config.openRouterRouting;
		if (draft.providerId !== 'openrouter' || !routing) return true;
		return !(['priority', 'only'].includes(routing.strategy) && !routing.providerOrder?.length);
	};

	const save = async () => {
		const draft = getValues();
		if (!validateDraft(draft)) {
			toaster.error({ title: t('provider.toasts.incompleteConnection') });
			return;
		}
		try {
			const payload = buildPayload(draft);
			await saveConnectionFx({
				scope,
				scopeId,
				providerId: draft.providerId,
				tokenId: draft.tokenId,
				model: draft.modelId,
				config: draft.config,
				preset: activePresetId ? { presetId: activePresetId, payload } : undefined,
			});
			draftsByProvider.current[draft.providerId] = draft;
			reset(draft);
			toaster.success({ title: t('provider.toasts.connectionSaved') });
		} catch (error) {
			toaster.error({
				title: t('provider.toasts.connectionSaveFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const checkConnection = async () => {
		try {
			setConnectionResult(await checkConnectionFx({ providerId, scope, scopeId, tokenId, config }));
		} catch (error) {
			toaster.error({
				title: t('provider.toasts.connectionCheckFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const resetChanges = () => {
		if (!runtime) return;
		const draft = toDraft(runtime, configs[runtime.activeProviderId]);
		draftsByProvider.current = { [runtime.activeProviderId]: draft };
		reset(draft);
	};

	const selectPreset = async (presetId: string | null, options?: { skipUnsavedConfirm?: boolean }) => {
		if (presetId === activePresetId) return;
		if (
			formState.isDirty &&
			!options?.skipUnsavedConfirm &&
			!window.confirm(t('provider.presets.confirm.discardChanges'))
		)
			return;
		if (!presetId) return void (await patchPresetSettingsFx({ activePresetId: null }));
		try {
			const result = await applyPresetFx({ presetId, scope, scopeId });
			toaster.success({
				title: t(
					result.warnings.length ? 'provider.presets.toasts.appliedWithWarnings' : 'provider.presets.toasts.applied',
				),
			});
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const canSave = formState.isDirty && validateDraft(getValues());
	const advancedSettings = (
		<LlmDisclosureSection title={t('provider.config.advancedTitle')}>
			<LlmProviderAdvancedConfig
				configDraft={config}
				onChange={(next) => setValue('config', next, { shouldDirty: true })}
			/>
		</LlmDisclosureSection>
	);

	return (
		<FormProvider {...form}>
			<Stack gap="lg">
				<LlmPresetManager
					presets={presets}
					presetSettings={presetSettings}
					hasUnsavedChanges={formState.isDirty}
					buildCurrentPayload={() => buildPayload()}
					onCreatePreset={(params) => createPresetFx(params)}
					onUpdatePreset={(params) => updatePresetFx(params)}
					onDeletePreset={(id) => deletePresetFx(id)}
					onSelectPreset={selectPreset}
					onPatchSettings={(params) => patchPresetSettingsFx(params)}
					onSaveCurrent={save}
					showSaveAction
				/>
				<Divider />
				<LlmConnectionEditor
					providers={providers}
					providerId={providerId}
					tokens={tokens}
					tokenId={tokenId}
					models={models}
					modelId={modelId}
					config={config}
					isLoadingModels={isLoadingModels}
					isChecking={isChecking}
					onProviderChange={changeProvider}
					onTokenChange={changeToken}
					onModelChange={changeModel}
					onConfigChange={(next) => setValue('config', next, { shouldDirty: true })}
					onRefreshModels={refreshModels}
					onCheckConnection={checkConnection}
				/>
				{providerId === 'openrouter' ? (
					<>
						<Divider />
						<Stack gap={0}>
							<OpenRouterRoutingEditor
								modelId={modelId}
								value={config.openRouterRouting}
								endpoints={endpoints}
								isLoading={isLoadingEndpoints}
								onReload={async () => {
									if (modelId) await refreshEndpoints(modelId);
								}}
								onChange={(routing) =>
									setValue('config', { ...config, openRouterRouting: routing }, { shouldDirty: true })
								}
							/>
							{advancedSettings}
						</Stack>
					</>
				) : (
					advancedSettings
				)}
				{connectionResult ? (
					<Alert
						color={connectionResult.ok ? 'green' : 'red'}
						title={t(
							connectionResult.ok ? 'provider.config.connectionSuccessTitle' : 'provider.config.connectionErrorTitle',
						)}
					>
						<Text size="sm">{connectionResult.message}</Text>
					</Alert>
				) : null}
				<Divider />
				<Group justify="space-between" wrap="wrap">
					<Button variant="subtle" leftSection={<LuRotateCcw />} disabled={!formState.isDirty} onClick={resetChanges}>
						{t('provider.actions.reset')}
					</Button>
					<Button loading={isSaving} disabled={!canSave} onClick={() => void save()}>
						{t('provider.actions.saveChanges')}
					</Button>
				</Group>
			</Stack>
		</FormProvider>
	);
};
