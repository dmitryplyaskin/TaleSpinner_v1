import { UserPerson } from '@shared/types/user-person';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../../api-routes';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/async-handler';

export const createEmptyUserPerson = (): UserPerson => ({
	id: uuidv4(),
	name: 'Новый пользователь',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	type: 'default',
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

export const getUserPersonListFx = createEffect<void, { data: UserPerson[] }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.userPerson.person.list());
		return response.json();
	}, 'Error fetching user person list'),
);

$userPersons.on(getUserPersonListFx.doneData, (_, { data }) => data);

export const getUserPersonFx = createEffect<string, { data: UserPerson }>((id) =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.userPerson.person.getById(id));
		return response.json();
	}, 'Error fetching user person'),
);

export const updateUserPersonFx = createEffect<UserPerson, void>((userPerson) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.userPerson.person.update(userPerson.id), {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(userPerson),
		});
	}, 'Error updating user person'),
);

export const createUserPersonFx = createEffect<UserPerson, void>((userPerson) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.userPerson.person.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(userPerson),
		});
	}, 'Error creating user person'),
);

export const deleteUserPersonFx = createEffect<string, void>((id) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.userPerson.person.delete(id), {
			method: 'DELETE',
		});
	}, 'Error deleting user person'),
);

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
