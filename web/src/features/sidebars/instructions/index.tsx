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

import { InstructionEditor } from './instruction-editor';

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

		const exportData = {
			type: 'talespinner.instruction',
			version: 1,
			instruction: {
				name: selectedInstruction.name,
				engine: selectedInstruction.engine,
				templateText: selectedInstruction.templateText,
				meta: selectedInstruction.meta ?? null,
			},
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `instruction-${selectedInstruction.name}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (readEvent) => {
			try {
				const content = String(readEvent.target?.result ?? '');
				const json = JSON.parse(content) as {
					type?: unknown;
					instruction?: {
						name?: unknown;
						templateText?: unknown;
						meta?: unknown;
					};
				};

				if (json.type !== 'talespinner.instruction' || !json.instruction || typeof json.instruction !== 'object') {
					toaster.error({
						title: t('instructions.toasts.importErrorTitle'),
						description: t('instructions.toasts.importReadError'),
					});
					return;
				}

				const name = typeof json.instruction.name === 'string' ? json.instruction.name : t('instructions.defaults.importedInstruction');
				const templateText = typeof json.instruction.templateText === 'string' ? json.instruction.templateText : '';
				const meta = typeof json.instruction.meta === 'undefined' ? undefined : json.instruction.meta;

				if (!templateText.trim()) {
					toaster.error({
						title: t('instructions.toasts.importErrorTitle'),
						description: t('instructions.toasts.importMissingTemplateText'),
					});
					return;
				}

				onImport({ name, templateText, meta });
				toaster.success({ title: t('instructions.toasts.importSuccessTitle'), description: name });
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
