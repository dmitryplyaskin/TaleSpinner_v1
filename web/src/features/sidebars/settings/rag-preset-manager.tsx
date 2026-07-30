import { useTranslation } from 'react-i18next';

import { toaster } from '@ui/toaster';

import { PresetControls } from './preset-controls';

import type { RagPreset, RagPresetPayload, RagPresetSettings } from '@shared/types/rag';

type Props = {
	presets: RagPreset[];
	settings: RagPresetSettings | null;
	hasUnsavedChanges: boolean;
	buildPayload: () => RagPresetPayload;
	onCreate: (params: { name: string; payload: RagPresetPayload }) => Promise<RagPreset>;
	onUpdate: (preset: RagPreset) => Promise<RagPreset>;
	onDelete: (id: string) => Promise<{ id: string }>;
	onSelect: (id: string, options?: { skipUnsavedConfirm?: boolean }) => Promise<void>;
	onSaveCurrent: () => Promise<void>;
};

export const RagPresetManager: React.FC<Props> = ({
	presets,
	settings,
	hasUnsavedChanges,
	buildPayload,
	onCreate,
	onUpdate,
	onDelete,
	onSelect,
	onSaveCurrent,
}) => {
	const { t } = useTranslation();
	const activePreset = presets.find((preset) => preset.id === settings?.selectedId) ?? null;
	const options = presets.map((preset) => ({ value: preset.id, label: preset.name }));
	const fail = (error: unknown) =>
		toaster.error({
			title: t('rag.presets.toasts.failed'),
			description: error instanceof Error ? error.message : String(error),
		});

	const create = async () => {
		const name = window.prompt(t('rag.presets.actions.createPrompt'), t('rag.presets.defaults.newPresetName'))?.trim();
		if (!name) return;
		try {
			const preset = await onCreate({ name, payload: buildPayload() });
			await onSelect(preset.id, { skipUnsavedConfirm: true });
			toaster.success({ title: t('rag.presets.toasts.created'), description: preset.name });
		} catch (error) {
			fail(error);
		}
	};

	const rename = async () => {
		if (!activePreset) return;
		const name = window.prompt(t('rag.presets.actions.renamePrompt'), activePreset.name)?.trim();
		if (!name) return;
		try {
			await onUpdate({ ...activePreset, name, updatedAt: new Date().toISOString() });
			toaster.success({ title: t('rag.presets.toasts.saved'), description: name });
		} catch (error) {
			fail(error);
		}
	};

	const duplicate = async () => {
		if (!activePreset) return;
		try {
			const preset = await onCreate({ name: `${activePreset.name} copy`, payload: activePreset.payload });
			await onSelect(preset.id, { skipUnsavedConfirm: true });
			toaster.success({ title: t('rag.presets.toasts.created'), description: preset.name });
		} catch (error) {
			fail(error);
		}
	};

	const remove = async () => {
		if (!activePreset || !window.confirm(t('rag.presets.confirm.delete'))) return;
		try {
			await onDelete(activePreset.id);
			toaster.success({ title: t('rag.presets.toasts.deleted'), description: activePreset.name });
		} catch (error) {
			fail(error);
		}
	};

	const select = async (id: string) => {
		try {
			await onSelect(id);
		} catch (error) {
			fail(error);
		}
	};

	return (
		<PresetControls
			labels={{
				title: t('rag.presets.title'),
				active: t('rag.presets.active'),
				create: t('rag.presets.actions.create'),
				rename: t('rag.presets.actions.rename'),
				duplicate: t('rag.presets.actions.duplicate'),
				save: t('rag.presets.actions.save'),
				delete: t('rag.presets.actions.delete'),
			}}
			options={options}
			value={settings?.selectedId ?? null}
			onChange={(id) => id && void select(id)}
			onCreate={() => void create()}
			onRename={() => void rename()}
			onDuplicate={() => void duplicate()}
			onSave={() => void onSaveCurrent()}
			onDelete={() => void remove()}
			disableRename={!activePreset}
			disableDuplicate={!activePreset}
			disableSave={!activePreset || !hasUnsavedChanges}
			disableDelete={!activePreset}
		/>
	);
};
