import { Drawer } from '@ui/drawer';

import { Button, Group, Select, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

import {
	$promptTemplateScope,
	$promptTemplates,
	$selectedPromptTemplateId,
	createPromptTemplateRequested,
	deletePromptTemplateRequested,
	setPromptTemplateScope,
	setSelectedPromptTemplateId,
} from '@model/prompt-templates';

import { PromptTemplateEditor } from './prompt-template-editor';

export const TemplateSidebar = () => {
	const [scope, templates, selectedId] = useUnit([$promptTemplateScope, $promptTemplates, $selectedPromptTemplateId]);

	const options = templates.map((t) => ({ value: t.id, label: t.name }));

	return (
		<Drawer name="templates" title="Prompt templates">
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<Select
						data={[
							{ value: 'chat', label: 'Chat' },
							{ value: 'entity_profile', label: 'Entity profile' },
							{ value: 'global', label: 'Global' },
						]}
						value={scope}
						onChange={(v) => {
							if (!v) return;
							setPromptTemplateScope(v as 'chat' | 'entity_profile' | 'global');
							setSelectedPromptTemplateId(null);
						}}
						comboboxProps={{ withinPortal: false }}
						style={{ width: 200 }}
					/>

					<Select
						data={options}
						value={selectedId}
						onChange={(id) => setSelectedPromptTemplateId(id ?? null)}
						placeholder="Выберите шаблон"
						comboboxProps={{ withinPortal: false }}
						style={{ flex: 1 }}
					/>

					<Group gap="xs" wrap="nowrap">
						<Button leftSection={<LuPlus />} onClick={() => createPromptTemplateRequested()}>
							Создать
						</Button>
						<Button
							leftSection={<LuTrash2 />}
							color="red"
							variant="outline"
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								if (!window.confirm('Удалить шаблон?')) return;
								deletePromptTemplateRequested({ id: selectedId });
							}}
						>
							Удалить
						</Button>
					</Group>
				</Group>

				<PromptTemplateEditor />
			</Stack>
		</Drawer>
	);
};
