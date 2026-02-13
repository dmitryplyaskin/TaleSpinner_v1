import { Group, Select, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import {
	$instructions,
	$selectedInstructionId,
	createInstructionRequested,
	deleteInstructionRequested,
	duplicateInstructionRequested,
	importInstructionRequested,
	instructionSelected,
} from '@model/instructions';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';
import {
	buildStPresetFromAdvanced,
	createStAdvancedConfigFromPreset,
	detectStChatCompletionPreset,
	deriveInstructionTemplateText,
	getTsInstructionMeta,
	hasSensitivePresetFields,
	withTsInstructionMeta,
} from '@model/instructions/st-preset';

import type { InstructionMeta } from '@shared/types/instructions';

import { InstructionEditor } from './instruction-editor';

function downloadJson(params: { fileName: string; data: unknown }): void {
	const blob = new Blob([JSON.stringify(params.data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = params.fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function getBasename(fileName: string): string {
	const idx = fileName.lastIndexOf('.');
	if (idx <= 0) return fileName;
	return fileName.slice(0, idx);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const InstructionsSidebar = () => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [items, selectedId] = useUnit([$instructions, $selectedInstructionId]);
	const onImport = useUnit(importInstructionRequested);

	const options = items
		.filter((item) => typeof item.id === 'string' && item.id.trim().length > 0)
		.map((item) => ({ value: item.id, label: item.name || item.id }));
	const selectedInstruction = items.find((item) => item.id === selectedId) ?? null;
	const selectedValue = options.some((item) => item.value === selectedId) ? selectedId : null;

	const doExport = () => {
		if (!selectedInstruction) {
			toaster.error({ title: t('instructions.toasts.exportNotPossibleTitle'), description: t('instructions.toasts.selectForExport') });
			return;
		}

		const tsInstruction = getTsInstructionMeta(selectedInstruction.meta);
		const stAdvanced = tsInstruction?.mode === 'st_advanced' ? tsInstruction.stAdvanced : null;
		const exportStCompatible = Boolean(stAdvanced) && window.confirm(t('instructions.confirm.exportStPreset'));

		if (exportStCompatible && stAdvanced) {
			const preset = buildStPresetFromAdvanced(stAdvanced);
			downloadJson({
				fileName: `${selectedInstruction.name}.json`,
				data: preset,
			});
			return;
		}

		downloadJson({
			fileName: `instruction-${selectedInstruction.name}.json`,
			data: {
				type: 'talespinner.instruction',
				version: 1,
				instruction: {
					name: selectedInstruction.name,
					engine: selectedInstruction.engine,
					templateText: selectedInstruction.templateText,
					meta: selectedInstruction.meta ?? null,
				},
			},
		});
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (readEvent) => {
			try {
				const content = String(readEvent.target?.result ?? '');
				const json = JSON.parse(content) as unknown;
				const fileName = getBasename(file.name).trim() || t('instructions.defaults.importedInstruction');

				if (
					isRecord(json) &&
					json.type === 'talespinner.instruction' &&
					isRecord(json.instruction)
				) {
					const name = typeof json.instruction.name === 'string' ? json.instruction.name : t('instructions.defaults.importedInstruction');
					const templateText = typeof json.instruction.templateText === 'string' ? json.instruction.templateText : '';
					const meta =
						isRecord(json.instruction.meta)
							? (json.instruction.meta as InstructionMeta)
							: undefined;

					if (!templateText.trim()) {
						toaster.error({
							title: t('instructions.toasts.importErrorTitle'),
							description: t('instructions.toasts.importMissingTemplateText'),
						});
						return;
					}

					onImport({ name, templateText, meta });
					toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: name });
					return;
				}

				if (detectStChatCompletionPreset(json)) {
					let sensitiveImportMode: 'remove' | 'keep' = 'keep';
					if (hasSensitivePresetFields(json)) {
						const removeSensitive = window.confirm(t('instructions.confirm.sensitiveRemove'));
						if (removeSensitive) {
							sensitiveImportMode = 'remove';
						} else {
							const importAsIs = window.confirm(t('instructions.confirm.sensitiveImportAsIs'));
							if (!importAsIs) return;
						}
					}

					const stAdvanced = createStAdvancedConfigFromPreset({
						preset: json,
						fileName: file.name,
						sensitiveImportMode,
					});
					const templateText = deriveInstructionTemplateText(stAdvanced);
					const meta = withTsInstructionMeta({
						meta: null,
						tsInstruction: {
							version: 1,
							mode: 'st_advanced',
							stAdvanced,
						},
					});

					onImport({
						name: fileName,
						templateText,
						meta,
					});
					toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: fileName });
					return;
				}

				toaster.error({
					title: t('instructions.toasts.importErrorTitle'),
					description: t('instructions.toasts.importReadError'),
				});
			} catch (error) {
				toaster.error({
					title: t('instructions.toasts.importErrorTitle'),
					description: error instanceof Error ? error.message : t('instructions.toasts.importReadError'),
				});
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = '';
			}
		};
		reader.readAsText(file);
	};

	return (
		<Drawer name="instructions" title={t('instructions.title')}>
			<Stack gap="md">
				<input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />

				<Group gap="sm" wrap="nowrap" className="ts-sidebar-toolbar">
					<Select
						data={options}
						value={selectedValue}
						onChange={(id) => {
							if (!id) return;
							instructionSelected(id);
						}}
						placeholder={t('instructions.placeholders.selectInstruction')}
						comboboxProps={{ withinPortal: false }}
						className="ts-sidebar-toolbar__main"
					/>

					<Group gap="xs" wrap="nowrap" className="ts-sidebar-toolbar__actions">
						<IconButtonWithTooltip
							tooltip={t('common.create')}
							icon={<LuPlus />}
							aria-label={t('common.create')}
							onClick={() => createInstructionRequested()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.duplicate')}
							icon={<LuCopy />}
							aria-label={t('common.duplicate')}
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								duplicateInstructionRequested({ id: selectedId });
							}}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.import')}
							icon={<LuUpload />}
							aria-label={t('common.import')}
							onClick={() => fileInputRef.current?.click()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.export')}
							icon={<LuDownload />}
							aria-label={t('common.export')}
							disabled={!selectedId}
							onClick={doExport}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.delete')}
							icon={<LuTrash2 />}
							aria-label={t('common.delete')}
							color="red"
							variant="outline"
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								if (!window.confirm(t('instructions.confirm.deleteInstruction'))) return;
								deleteInstructionRequested({ id: selectedId });
							}}
						/>
					</Group>
				</Group>

				<InstructionEditor />
			</Stack>
		</Drawer>
	);
};
