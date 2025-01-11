import { BASE_URL } from './const';

export const apiRoutes = {
	userPerson: {
		person: {
			list: () => `${BASE_URL}/user-persons`,
			getById: (id: string) => `${BASE_URL}/user-persons/${id}`,
			create: () => `${BASE_URL}/user-persons`,
			update: (id: string) => `${BASE_URL}/user-persons/${id}`,
			delete: (id: string) => `${BASE_URL}/user-persons/${id}`,
		},
		settings: {
			get: () => `${BASE_URL}/user-persons/settings`,
			update: () => `${BASE_URL}/user-persons/settings`,
		},
	},
};
