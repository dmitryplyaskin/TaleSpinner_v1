import { type TemplateType, type TemplateSettingsType } from '@shared/types/templates';
import { v4 as uuidv4 } from 'uuid';

import { createModel } from '@model/_fabric_';

export const templatesModel = createModel<TemplateSettingsType, TemplateType>({
	settings: {
		route: '/settings/templates',
	},

	items: {
		route: '/templates',
	},
	fabricName: 'templates',
});

export const createEmptyTemplate = (): TemplateType => ({
	id: uuidv4(),
	name: 'Новый шаблон',
	template: '',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});
