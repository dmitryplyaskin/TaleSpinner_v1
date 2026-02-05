import { Drawer } from '@ui/drawer';

import { Group, Select, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { LuCopy, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import {
	$promptTemplates,
	$selectedPromptTemplateId,
	createPromptTemplateRequested,
	duplicatePromptTemplateRequested,
	deletePromptTemplateRequested,
	importPromptTemplateRequested,
	promptTemplateSelected,
} from '@model/prompt-templates';

import { toaster } from '@ui/toaster';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { PromptTemplateEditor } from './prompt-template-editor';

export const TemplateSidebar = () => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [templates, selectedId] = useUnit([$promptTemplates, $selectedPromptTemplateId]);
	const onImport = useUnit(importPromptTemplateRequested);

	const options = templates.map((t) => ({ value: t.id, label: t.name }));
	const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

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
		reader.onload = (e) => {
			try {
				const content = String(e.target?.result ?? '');
				const json = JSON.parse(content) as any;

				const tpl = json?.template ?? json?.promptTemplate ?? json;
				const name = typeof tpl?.name === 'string' ? tpl.name : 'Imported template';
				const templateText = typeof tpl?.templateText === 'string' ? tpl.templateText : typeof tpl?.template === 'string' ? tpl.template : '';
				const meta = typeof tpl?.meta === 'undefined' ? undefined : tpl.meta;

				if (!templateText.trim()) {
					toaster.error({ title: 'Ошибка импорта', description: 'Файл не содержит templateText' });
					return;
				}

				onImport({ name, templateText, meta });
				toaster.success({ title: 'Импорт успешен', description: name });
			} catch (err) {
				toaster.error({
					title: 'Ошибка импорта',
					description: err instanceof Error ? err.message : 'Не удалось прочитать файл',
				});
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = '';
			}
		};
		reader.readAsText(file);
	};

	return (
		<Drawer name="templates" title="Prompt templates">
			<Stack gap="md">
				<input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />

				<Group gap="sm" wrap="nowrap">
					<Select
						data={options}
						value={selectedId}
						onChange={(id) => {
							if (!id) return;
							promptTemplateSelected(id);
						}}
						placeholder="Выберите шаблон"
						comboboxProps={{ withinPortal: false }}
						style={{ flex: 1 }}
					/>

					<Group gap="xs" wrap="nowrap">
						<IconButtonWithTooltip
							tooltip="Создать"
							icon={<LuPlus />}
							aria-label="Create"
							onClick={() => createPromptTemplateRequested()}
						/>
						<IconButtonWithTooltip
							tooltip="Дублировать"
							icon={<LuCopy />}
							aria-label="Duplicate"
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								duplicatePromptTemplateRequested({ id: selectedId });
							}}
						/>
						<IconButtonWithTooltip
							tooltip="Импортировать"
							icon={<LuUpload />}
							aria-label="Import"
							onClick={() => fileInputRef.current?.click()}
						/>
						<IconButtonWithTooltip
							tooltip="Экспортировать"
							icon={<LuDownload />}
							aria-label="Export"
							disabled={!selectedId}
							onClick={doExport}
						/>
						<IconButtonWithTooltip
							tooltip="Удалить"
							icon={<LuTrash2 />}
							aria-label="Delete"
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
