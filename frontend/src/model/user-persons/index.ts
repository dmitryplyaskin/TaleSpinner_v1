import { createModel } from '@model/_fabric_';
import { UserPerson, UserPersonSettings } from '@shared/types/user-person';
import { v4 as uuidv4 } from 'uuid';

export const userPersonsModel = createModel<UserPersonSettings, UserPerson>({
	settings: {
		route: '/settings/user-persons',
	},

	items: {
		route: '/user-persons',
	},
	fabricName: 'user-persons',
});

export const createEmptyUserPerson = (): UserPerson => ({
	id: uuidv4(),
	name: 'Новый пользователь',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	type: 'default',
});
