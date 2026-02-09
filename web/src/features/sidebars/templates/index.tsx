import { Group, Select, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import {
	$promptTemplates,
	$selectedPromptTemplateId,
	createPromptTemplateRequested,
	deletePromptTemplateRequested,
	duplicatePromptTemplateRequested,
	importPromptTemplateRequested,
	promptTemplateSelected,
} from '@model/prompt-templates';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { PromptTemplateEditor } from './prompt-template-editor';

export const TemplateSidebar = () => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [templates, selectedId] = useUnit([$promptTemplates, $selectedPromptTemplateId]);
	const onImport = useUnit(importPromptTemplateRequested);

	const options = templates.map((template) => ({ value: template.id, label: template.name }));
	const selectedTemplate = templates.find((template) => template.id === selectedId) ?? null;

	const doExport = () => {
		if (!selectedTemplate) {
			toaster.error({ title: 'Экспорт невозможен', description: 'Выберите шаблон для экспорта' });
			return;
		}

		const exportData = {
			type: 'talespinner.promptTemplate',
			version: 1,
			template: {
				name: selectedTemplate.name,
				engine: selectedTemplate.engine,
				templateText: selectedTemplate.templateText,
				meta: selectedTemplate.meta ?? null,
			},
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `prompt-template-${selectedTemplate.name}.json`;
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
				const json = JSON.parse(content) as any;

				const template = json?.template ?? json?.promptTemplate ?? json;
				const name = typeof template?.name === 'string' ? template.name : 'Imported template';
				const templateText =
					typeof template?.templateText === 'string' ? template.templateText : typeof template?.template === 'string' ? template.template : '';
				const meta = typeof template?.meta === 'undefined' ? undefined : template.meta;

				if (!templateText.trim()) {
					toaster.error({ title: 'Ошибка импорта', description: 'Файл не содержит templateText' });
					return;
				}

				onImport({ name, templateText, meta });
				toaster.success({ title: 'Импорт успешен', description: name });
			} catch (error) {
				toaster.error({
					title: 'Ошибка импорта',
					description: error instanceof Error ? error.message : 'Не удалось прочитать файл',
				});
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = '';
			}
		};
		reader.readAsText(file);
	};

	return (
		<Drawer name="templates" title={t('sidebars.templatesTitle')}>
			<Stack gap="md">
				<input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />

				<Group gap="sm" wrap="nowrap" className="ts-sidebar-toolbar">
					<Select
						data={options}
						value={selectedId}
						onChange={(id) => {
							if (!id) return;
							promptTemplateSelected(id);
						}}
						placeholder={t('sidebars.selectTemplate')}
						comboboxProps={{ withinPortal: false }}
						className="ts-sidebar-toolbar__main"
					/>

					<Group gap="xs" wrap="nowrap" className="ts-sidebar-toolbar__actions">
						<IconButtonWithTooltip
							tooltip={t('common.create')}
							icon={<LuPlus />}
							aria-label={t('common.create')}
							onClick={() => createPromptTemplateRequested()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.duplicate')}
							icon={<LuCopy />}
							aria-label={t('common.duplicate')}
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								duplicatePromptTemplateRequested({ id: selectedId });
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
								if (!window.confirm('Удалить шаблон?')) return;
								deletePromptTemplateRequested({ id: selectedId });
							}}
						/>
					</Group>
				</Group>

				<PromptTemplateEditor />
			</Stack>
		</Drawer>
	);
};
