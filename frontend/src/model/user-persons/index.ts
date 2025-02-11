import { createModel } from '@model/_fabric_';
import { UserPersonType, UserPersonSettingsType } from '@shared/types/user-person';
import { v4 as uuidv4 } from 'uuid';

export const userPersonsModel = createModel<UserPersonSettingsType, UserPersonType>({
	settings: {
		route: '/settings/user-persons',
	},

	items: {
		route: '/user-persons',
	},
	fabricName: 'user-persons',
});

export const createEmptyUserPerson = (): UserPersonType => ({
	id: uuidv4(),
	name: 'Новый пользователь',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	type: 'default',
});
