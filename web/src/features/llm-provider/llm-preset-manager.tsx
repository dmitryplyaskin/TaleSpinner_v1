import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { toaster } from '@ui/toaster';

import type { LlmPresetDto, LlmPresetSettingsDto } from '../../api/llm';
import type { LlmPresetPayload, LlmScope } from '@shared/types/llm';

type Props = {
	scope: LlmScope;
	scopeId: string;
	presets: LlmPresetDto[];
	presetSettings: LlmPresetSettingsDto | null;
	buildCurrentPayload: () => LlmPresetPayload;
	onCreatePreset: (params: { name: string; payload: LlmPresetPayload }) => Promise<LlmPresetDto>;
	onUpdatePreset: (params: { presetId: string; payload: LlmPresetPayload }) => Promise<LlmPresetDto>;
	onDeletePreset: (presetId: string) => Promise<{ id: string }>;
	onApplyPreset: (params: { presetId: string; scope: LlmScope; scopeId: string }) => Promise<{
		preset: LlmPresetDto;
		warnings: string[];
	}>;
	onPatchSettings: (params: { activePresetId?: string | null }) => Promise<LlmPresetSettingsDto>;
};

function resolveCopyName(base: string, used: Set<string>): string {
	const trimmed = base.trim() || 'Preset';
	if (!used.has(trimmed)) return trimmed;
	for (let idx = 2; idx < 10000; idx += 1) {
		const candidate = `${trimmed} ${idx}`;
		if (!used.has(candidate)) return candidate;
	}
	return `${trimmed} ${Date.now()}`;
}

export const LlmPresetManager: React.FC<Props> = ({
	scope,
	scopeId,
	presets,
	presetSettings,
	buildCurrentPayload,
	onCreatePreset,
	onUpdatePreset,
	onDeletePreset,
	onApplyPreset,
	onPatchSettings,
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
			await onPatchSettings({ activePresetId: created.presetId });
			toaster.success({ title: t('provider.presets.toasts.created'), description: created.name });
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const savePreset = async () => {
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
			const used = new Set(presets.map((item) => item.name));
			const name = resolveCopyName(`${source.name} (copy)`, used);
			const created = await onCreatePreset({
				name,
				payload: source.payload,
			});
			await onPatchSettings({ activePresetId: created.presetId });
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

	const applyPreset = async () => {
		if (!activePresetId) return;
		try {
			const result = await onApplyPreset({
				presetId: activePresetId,
				scope,
				scopeId,
			});
			if (result.warnings.length > 0) {
				toaster.warning({
					title: t('provider.presets.toasts.appliedWithWarnings'),
					description: result.warnings.join('; '),
				});
				return;
			}
			toaster.success({
				title: t('provider.presets.toasts.applied'),
				description: result.preset.name,
			});
		} catch (error) {
			toaster.error({
				title: t('provider.presets.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return (
		<Stack gap="xs">
			<Text fw={600}>{t('provider.presets.title')}</Text>
			<Select
				label={t('provider.presets.active')}
				data={options}
				value={activePresetId}
				onChange={(value) => void onPatchSettings({ activePresetId: value ?? null })}
				clearable
				searchable
				comboboxProps={{ withinPortal: false }}
			/>
			<Group gap="xs">
				<Button size="xs" variant="light" onClick={() => void createPreset()}>
					{t('provider.presets.actions.create')}
				</Button>
				<Button size="xs" variant="outline" onClick={() => void savePreset()} disabled={!activePreset}>
					{t('provider.presets.actions.save')}
				</Button>
				<Button size="xs" variant="default" onClick={() => void duplicatePreset()} disabled={!activePreset}>
					{t('provider.presets.actions.duplicate')}
				</Button>
				<Button size="xs" variant="default" onClick={() => void applyPreset()} disabled={!activePresetId}>
					{t('provider.presets.actions.apply')}
				</Button>
				<Button size="xs" color="red" variant="light" onClick={() => void deletePreset()} disabled={!activePreset}>
					{t('provider.presets.actions.delete')}
				</Button>
			</Group>
		</Stack>
	);
};
