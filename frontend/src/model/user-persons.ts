import { UserPerson, UserPersonSettings } from '@types/user-person';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../api-routes';
import { v4 as uuidv4 } from 'uuid';

const defaultSettings = {
	isUserPersonEnabled: false,
	selectedUserPersonId: null,
};

export const createEmptyUserPerson = () =>
	({
		id: uuidv4(),
		name: 'Новый пользователь',
		content: {
			type: 'default',
			value: '',
		},
	} as UserPerson);

export const $userPersonsSettings = createStore<UserPersonSettings>(defaultSettings);

export const updateUserPersonSettings = createEvent<UserPersonSettings>();

export const getUserPersonSettingsFx = createEffect<void, UserPersonSettings>(async () => {
	try {
		const settings = await fetch(apiRoutes.userPerson.settings.get()).then((response) => response.json());

		return settings;
	} catch (error) {
		console.error('Error fetching user person settings:', error);
		return defaultSettings;
	}
});

export const saveUserPersonSettingsFx = createEffect<UserPersonSettings, void>(async (settings) => {
	try {
		await fetch(apiRoutes.userPerson.settings.update(), {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(settings),
		});
	} catch (error) {
		console.error('Error saving user person settings:', error);
	}
});

$userPersonsSettings
	.on(getUserPersonSettingsFx.doneData, (_, payload) => payload)
	.on(updateUserPersonSettings, (_, payload) => payload);

sample({
	clock: updateUserPersonSettings,
	target: saveUserPersonSettingsFx,
});

export const $userPersons = createStore<UserPerson[]>([]);

export const updateUserPerson = createEvent<UserPerson>();
export const deleteUserPerson = createEvent<string>();
export const createUserPerson = createEvent<UserPerson>();

$userPersons
	.on(updateUserPerson, (userPersons, userPerson) => {
		const updatedUserPersons = userPersons.map((up) => {
			if (up.id === userPerson.id) {
				return userPerson;
			}
			return up;
		});
		return updatedUserPersons;
	})
	.on(createUserPerson, (userPersons, userPerson) => {
		return [...userPersons, userPerson];
	})
	.on(deleteUserPerson, (userPersons, id) => {
		return userPersons.filter((up) => up.id !== id);
	});

export const getUserPersonListFx = createEffect<void, { data: UserPerson[] }>(async () => {
	try {
		const response = await fetch(apiRoutes.userPerson.person.list()).then((response) => response.json());

		return response;
	} catch (error) {
		console.error('Error fetching user person list:', error);
		return { data: [] };
	}
});

$userPersons.on(getUserPersonListFx.doneData, (_, { data }) => data);

export const getUserPersonFx = createEffect<string, { data: UserPerson }>(async (id) => {
	try {
		const response = await fetch(apiRoutes.userPerson.person.getById(id)).then((response) => response.json());
		return { data: response };
	} catch (error) {
		console.error('Error fetching user person:', error);
		return { data: null };
	}
});

export const updateUserPersonFx = createEffect<UserPerson, void>(async (userPerson) => {
	try {
		await fetch(apiRoutes.userPerson.person.update(userPerson.id), {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(userPerson),
		});
	} catch (error) {
		console.error('Error updating user person:', error);
	}
});

export const createUserPersonFx = createEffect<UserPerson, void>(async (userPerson) => {
	try {
		await fetch(apiRoutes.userPerson.person.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(userPerson),
		});
	} catch (error) {
		console.error('Error creating user person:', error);
	}
});

export const deleteUserPersonFx = createEffect<string, void>(async (id) => {
	try {
		await fetch(apiRoutes.userPerson.person.delete(id), {
			method: 'DELETE',
		});
	} catch (error) {
		console.error('Error deleting user person:', error);
	}
});

sample({
	clock: updateUserPerson,
	target: updateUserPersonFx,
});

sample({
	clock: createUserPerson,
	target: createUserPersonFx,
});

sample({
	clock: deleteUserPerson,
	target: deleteUserPersonFx,
});

sample({
	clock: [updateUserPersonFx, createUserPersonFx, deleteUserPersonFx],
	target: getUserPersonListFx,
});
