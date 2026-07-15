import { useTranslation } from 'react-i18next';

import { toaster } from '@ui/toaster';

import { PresetControls } from '../sidebars/settings/preset-controls';

import type { LlmPresetDto, LlmPresetSettingsDto } from '../../api/llm';
import type { LlmPresetPayload } from '@shared/types/llm';

type Props = {
	presets: LlmPresetDto[];
	presetSettings: LlmPresetSettingsDto | null;
	hasUnsavedChanges: boolean;
	buildCurrentPayload: () => LlmPresetPayload;
	onCreatePreset: (params: { name: string; payload: LlmPresetPayload }) => Promise<LlmPresetDto>;
	onUpdatePreset: (params: {
		presetId: string;
		name?: string;
		description?: string | null;
		payload?: LlmPresetPayload;
	}) => Promise<LlmPresetDto>;
	onDeletePreset: (presetId: string) => Promise<{ id: string }>;
	onSelectPreset: (presetId: string | null, options?: { skipUnsavedConfirm?: boolean }) => Promise<void> | void;
	onPatchSettings: (params: { activePresetId?: string | null }) => Promise<LlmPresetSettingsDto>;
	onSaveCurrent?: () => Promise<void>;
	showSaveAction?: boolean;
};

export const LlmPresetManager: React.FC<Props> = ({
	presets,
	presetSettings,
	hasUnsavedChanges,
	buildCurrentPayload,
	onCreatePreset,
	onUpdatePreset,
	onDeletePreset,
	onSelectPreset,
	onPatchSettings,
	onSaveCurrent,
	showSaveAction = true,
}) => {
	const { t } = useTranslation();

	const activePresetId = presetSettings?.activePresetId ?? null;
	const activePreset = presets.find((item) => item.presetId === activePresetId) ?? null;
	const options = presets.map((item) => ({ value: item.presetId, label: item.name }));

	const createPreset = async () => {
		const fallback = t('provider.presets.defaults.newPresetName');
		const rawName = window.prompt(t('provider.presets.actions.createPrompt'), fallback);
		const name = rawName?.trim();
		if (!name) return;
		try {
			const created = await onCreatePreset({
				name,
				payload: buildCurrentPayload(),
			});
			await onSelectPreset(created.presetId, { skipUnsavedConfirm: true });
			toaster.success({ title: t('provider.presets.toasts.created'), description: created.name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const savePreset = async () => {
		if (onSaveCurrent) return onSaveCurrent();
		if (!activePreset) return;
		try {
			await onUpdatePreset({
				presetId: activePreset.presetId,
				payload: buildCurrentPayload(),
			});
			toaster.success({ title: t('provider.presets.toasts.saved'), description: activePreset.name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const duplicatePreset = async () => {
		try {
			const source = activePreset;
			if (!source) return;
			const created = await onCreatePreset({
				name: `${source.name} copy`,
				payload: source.payload,
			});
			await onSelectPreset(created.presetId, { skipUnsavedConfirm: true });
			toaster.success({ title: t('provider.presets.toasts.created'), description: created.name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const deletePreset = async () => {
		if (!activePreset) return;
		if (!window.confirm(t('provider.presets.confirm.delete'))) return;
		try {
			await onDeletePreset(activePreset.presetId);
			if (activePresetId === activePreset.presetId) {
				await onPatchSettings({ activePresetId: null });
			}
			toaster.success({ title: t('provider.presets.toasts.deleted'), description: activePreset.name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const renamePreset = async () => {
		if (!activePreset) return;
		const name = window.prompt(t('provider.presets.actions.renamePrompt'), activePreset.name)?.trim();
		if (!name) return;
		try {
			await onUpdatePreset({
				presetId: activePreset.presetId,
				name,
			});
			toaster.success({ title: t('provider.presets.toasts.saved'), description: name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return (
		<PresetControls
			labels={{
				title: t('provider.presets.title'),
				active: t('provider.presets.active'),
				create: t('provider.presets.actions.create'),
				rename: t('provider.presets.actions.rename'),
				duplicate: t('provider.presets.actions.duplicate'),
				save: t('provider.presets.actions.save'),
				delete: t('provider.presets.actions.delete'),
			}}
			options={options}
			value={activePresetId}
			onChange={(value) => void onSelectPreset(value ?? null)}
			onCreate={() => void createPreset()}
			onRename={() => void renamePreset()}
			onDuplicate={() => void duplicatePreset()}
			onSave={() => void savePreset()}
			onDelete={() => void deletePreset()}
			disableRename={!activePreset}
			disableDuplicate={!activePreset}
			disableSave={!hasUnsavedChanges || (!onSaveCurrent && !activePreset)}
			disableDelete={!activePreset}
			showSaveAction={showSaveAction}
		/>
	);
};
