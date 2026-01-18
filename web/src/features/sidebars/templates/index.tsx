import { useUnit } from 'effector-react';

import { createEmptyTemplate, templatesModel } from '@model/template';
import { Drawer } from '@ui/drawer';

import { SidebarHeader } from '../common/sidebar-header';

import { TemplateEditor } from './template-editor';

export const TemplateSidebar = () => {
	const templates = useUnit(templatesModel.$items);
	const settings = useUnit(templatesModel.$settings);

	return (
		<Drawer name="templates" title="Шаблоны">
			<SidebarHeader
				model={templatesModel}
				items={templates}
				settings={settings}
				name="template"
				createEmptyItem={createEmptyTemplate}
				labels={{
					createTooltip: 'Создать шаблон',
					duplicateTooltip: 'Дублировать шаблон',
					deleteTooltip: 'Удалить шаблон',
					createAriaLabel: 'Create template',
					duplicateAriaLabel: 'Duplicate template',
					deleteAriaLabel: 'Delete template',
				}}
			/>

			{settings.selectedId && <TemplateEditor />}
		</Drawer>
	);
};
