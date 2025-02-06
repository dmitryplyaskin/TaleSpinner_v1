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
			get: () => `${BASE_URL}/settings/user-person`,
			update: () => `${BASE_URL}/settings/user-person`,
		},
	},
	chat: {
		list: () => `${BASE_URL}/chats`,
		getById: (id: string) => `${BASE_URL}/chats/${id}`,
		create: () => `${BASE_URL}/chats`,
		update: (id: string) => `${BASE_URL}/chats/${id}`,
		delete: (id: string) => `${BASE_URL}/chats/${id}`,
		duplicate: (id: string) => `${BASE_URL}/chats/${id}/duplicate`,
		chat: () => `${BASE_URL}/chat`,
	},
	sidebars: {
		get: () => `${BASE_URL}/sidebars`,
		save: () => `${BASE_URL}/sidebars`,
	},
	files: {
		upload: () => `${BASE_URL}/files/upload`,
		uploadCard: () => `${BASE_URL}/files/upload-card`,
		getById: (filename: string) => `${BASE_URL}/files/${filename}`,
		delete: (filename: string) => `${BASE_URL}/files/${filename}`,
		metadata: (filename: string) => `${BASE_URL}/files/metadata/${filename}`,
	},
	instructions: {
		list: () => `${BASE_URL}/instructions`,
		getById: (id: string) => `${BASE_URL}/instructions/${id}`,
		create: () => `${BASE_URL}/instructions`,
		update: (id: string) => `${BASE_URL}/instructions/${id}`,
		delete: (id: string) => `${BASE_URL}/instructions/${id}`,
		settings: {
			get: () => `${BASE_URL}/instructions/settings`,
			update: () => `${BASE_URL}/instructions/settings`,
		},
	},
};
