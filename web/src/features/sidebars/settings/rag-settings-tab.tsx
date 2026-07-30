import { Alert, Button, Divider, Group, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ragProviderModel } from '@model/rag-provider';
import { ArrowCounterClockwiseIcon } from '@ui/icons';
import { toaster } from '@ui/toaster';

import { LlmDisclosureSection } from '../../llm-provider/llm-disclosure-section';

import { RagConnectionEditor } from './rag-connection-editor';
import { RagPresetManager } from './rag-preset-manager';
import { RagProviderAdvancedConfig } from './rag-provider-advanced-config';
import {
	createRagProviderDraft,
	normalizeRagProviderConfig,
	type RagProviderDraft,
} from './rag-provider-draft';

import type { RagPresetPayload, RagProviderConnectionCheckResult, RagProviderId } from '@shared/types/rag';

export const RagSettingsTab = () => {
	const { t } = useTranslation();
	const [
		providers,
		runtime,
		configs,
		tokensByProvider,
		modelsByKey,
		presets,
		presetSettings,
		mount,
		loadConfigFx,
		loadTokensFx,
		loadModelsFx,
		checkConnectionFx,
		saveConnectionFx,
		createPresetFx,
		updatePresetFx,
		deletePresetFx,
		applyPresetFx,
		isLoadingModels,
		isChecking,
		isSaving,
	] = useUnit([
		ragProviderModel.$providers,
		ragProviderModel.$runtime,
		ragProviderModel.$configs,
		ragProviderModel.$tokens,
		ragProviderModel.$modelsByProviderTokenKey,
		ragProviderModel.$presets,
		ragProviderModel.$presetSettings,
		ragProviderModel.ragMounted,
		ragProviderModel.loadConfigFx,
		ragProviderModel.loadTokensFx,
		ragProviderModel.loadModelsFx,
		ragProviderModel.checkConnectionFx,
		ragProviderModel.saveConnectionFx,
		ragProviderModel.createPresetFx,
		ragProviderModel.updatePresetFx,
		ragProviderModel.deletePresetFx,
		ragProviderModel.applyPresetFx,
		ragProviderModel.loadModelsFx.pending,
		ragProviderModel.checkConnectionFx.pending,
		ragProviderModel.saveConnectionFx.pending,
	]);

	const form = useForm<RagProviderDraft>({
		defaultValues: createRagProviderDraft('openrouter'),
	});
	const { control, formState, getValues, reset, setValue } = form;
	const providerId = useWatch({ control, name: 'providerId' });
	const tokenId = useWatch({ control, name: 'tokenId' });
	const modelId = useWatch({ control, name: 'modelId' });
	const config = useWatch({ control, name: 'config' });
	const initializedSignature = useRef('');
	const draftsByProvider = useRef<Partial<Record<RagProviderId, RagProviderDraft>>>({});
	const [connectionResult, setConnectionResult] = useState<RagProviderConnectionCheckResult | null>(null);

	useEffect(() => mount(), [mount]);
	useEffect(() => {
		if (!runtime) return;
		const runtimeConfig = configs[runtime.activeProviderId];
		const signature = JSON.stringify([runtime, runtimeConfig ?? null, presetSettings?.selectedId ?? null]);
		if (signature === initializedSignature.current) return;
		initializedSignature.current = signature;
		const draft = createRagProviderDraft(runtime.activeProviderId, runtimeConfig, runtime);
		draftsByProvider.current[runtime.activeProviderId] = draft;
		reset(draft);
	}, [configs, presetSettings?.selectedId, reset, runtime]);
	useEffect(() => setConnectionResult(null), [config, modelId, providerId, tokenId]);

	const tokens = tokensByProvider[providerId] ?? [];
	const models = modelsByKey[`${providerId}:${tokenId ?? 'none'}`] ?? [];
	const activePreset = presets.find((preset) => preset.id === presetSettings?.selectedId) ?? null;

	const buildPayload = (draft = getValues()): RagPresetPayload => ({
		activeProviderId: draft.providerId,
		activeTokenId: draft.providerId === 'openrouter' ? draft.tokenId : null,
		activeModel: draft.modelId,
		providerConfigsById: {
			openrouter:
				draft.providerId === 'openrouter'
					? draft.config
					: normalizeRagProviderConfig('openrouter', configs.openrouter),
			ollama:
				draft.providerId === 'ollama' ? draft.config : normalizeRagProviderConfig('ollama', configs.ollama),
		},
	});

	const changeProvider = async (nextProviderId: RagProviderId) => {
		draftsByProvider.current[providerId] = getValues();
		const [loadedConfig] = await Promise.all([loadConfigFx(nextProviderId), loadTokensFx(nextProviderId)]);
		const nextDraft =
			draftsByProvider.current[nextProviderId] ??
			createRagProviderDraft(nextProviderId, loadedConfig.config, runtime);
		draftsByProvider.current[nextProviderId] = nextDraft;
		setValue('providerId', nextProviderId, { shouldDirty: true });
		setValue('tokenId', nextDraft.tokenId, { shouldDirty: true });
		setValue('modelId', nextDraft.modelId, { shouldDirty: true });
		setValue('config', nextDraft.config, { shouldDirty: true });
		if (nextDraft.tokenId) await loadModelsFx({ providerId: nextProviderId, tokenId: nextDraft.tokenId });
	};

	const changeToken = async (nextTokenId: string | null) => {
		setValue('tokenId', nextTokenId, { shouldDirty: true });
		if (nextTokenId) await loadModelsFx({ providerId, tokenId: nextTokenId });
	};

	const changeModel = async (nextModelId: string | null) => {
		setValue('modelId', nextModelId, { shouldDirty: true });
	};

	const refreshModels = async () => {
		if (!tokenId) return;
		const result = await loadModelsFx({ providerId, tokenId });
		if (result.models.length === 0) toaster.warning({ title: t('rag.toasts.modelsEmpty') });
	};

	const validate = (draft: RagProviderDraft) =>
		Boolean(
			draft.modelId?.trim() &&
				(draft.providerId !== 'openrouter' || draft.tokenId) &&
				(draft.providerId !== 'ollama' || String(draft.config.baseUrl ?? '').trim()),
		);

	const save = async () => {
		const draft = getValues();
		if (!validate(draft)) {
			toaster.error({ title: t('rag.toasts.incompleteConnection') });
			return;
		}
		try {
			const payload = buildPayload(draft);
			await saveConnectionFx({
				providerId: draft.providerId,
				tokenId: draft.tokenId,
				model: draft.modelId,
				config: draft.config,
				preset: activePreset
					? { ...activePreset, payload, updatedAt: new Date().toISOString() }
					: undefined,
			});
			draftsByProvider.current[draft.providerId] = draft;
			reset(draft);
			toaster.success({ title: t('rag.toasts.connectionSaved') });
		} catch (error) {
			toaster.error({
				title: t('rag.toasts.connectionSaveFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const checkConnection = async () => {
		try {
			setConnectionResult(await checkConnectionFx({ providerId, tokenId, config }));
		} catch (error) {
			toaster.error({
				title: t('rag.toasts.connectionCheckFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const resetChanges = () => {
		if (!runtime) return;
		const draft = createRagProviderDraft(runtime.activeProviderId, configs[runtime.activeProviderId], runtime);
		draftsByProvider.current = { [runtime.activeProviderId]: draft };
		reset(draft);
	};

	const selectPreset = async (id: string, options?: { skipUnsavedConfirm?: boolean }) => {
		if (id === presetSettings?.selectedId) return;
		if (formState.isDirty && !options?.skipUnsavedConfirm && !window.confirm(t('rag.presets.confirm.discardChanges')))
			return;
		const result = await applyPresetFx(id);
		if (result.preset) toaster.success({ title: t('rag.presets.toasts.applied') });
	};

	return (
		<FormProvider {...form}>
			<Stack gap="lg">
				<RagPresetManager
					presets={presets}
					settings={presetSettings}
					hasUnsavedChanges={formState.isDirty}
					buildPayload={() => buildPayload()}
					onCreate={createPresetFx}
					onUpdate={updatePresetFx}
					onDelete={deletePresetFx}
					onSelect={selectPreset}
					onSaveCurrent={save}
				/>
				<Divider />
				<RagConnectionEditor
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
					onRefreshTokens={async () => {
						await loadTokensFx(providerId);
					}}
					onCheckConnection={checkConnection}
				/>
				<LlmDisclosureSection title={t('rag.config.advancedTitle')}>
					<RagProviderAdvancedConfig
						providerId={providerId}
						config={config}
						onChange={(next) => setValue('config', next, { shouldDirty: true })}
					/>
				</LlmDisclosureSection>
				{connectionResult ? (
					<Alert color={connectionResult.ok ? 'green' : 'red'} title={t(connectionResult.ok ? 'rag.connection.success' : 'rag.connection.error')}>
						<Text size="sm">{connectionResult.message}</Text>
					</Alert>
				) : null}
				<Divider />
				<Group justify="space-between" wrap="wrap">
					<Button variant="subtle" leftSection={<ArrowCounterClockwiseIcon />} disabled={!formState.isDirty} onClick={resetChanges}>
						{t('rag.actions.reset')}
					</Button>
					<Button loading={isSaving} disabled={!formState.isDirty || !validate(getValues())} onClick={() => void save()}>
						{t('rag.actions.saveChanges')}
					</Button>
				</Group>
			</Stack>
		</FormProvider>
	);
};
