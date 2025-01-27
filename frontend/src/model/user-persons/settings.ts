import { UserPersonSettings } from '@shared/types/user-person';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../../api-routes';
import { asyncHandler } from '../utils/async-handler';

export const defaultSettings = {
	isUserPersonEnabled: false,
	selectedUserPersonId: null,
};

export const $userPersonsSettings = createStore<UserPersonSettings>(defaultSettings);

export const updateUserPersonSettings = createEvent<UserPersonSettings>();

export const getUserPersonSettingsFx = createEffect<void, UserPersonSettings>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.userPerson.settings.get());
		return response.json();
	}, 'Error fetching user person settings'),
);

export const saveUserPersonSettingsFx = createEffect<UserPersonSettings, void>((settings) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.userPerson.settings.update(), {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(settings),
		});
	}, 'Error saving user person settings'),
);

$userPersonsSettings
	.on(getUserPersonSettingsFx.doneData, (_, payload) => payload)
	.on(updateUserPersonSettings, (_, payload) => payload);

sample({
	clock: updateUserPersonSettings,
	target: saveUserPersonSettingsFx,
});

getUserPersonSettingsFx();
