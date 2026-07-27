export default {
	setup: {
		title: 'Создание первого аккаунта',
		description: {
			local: 'Создайте локальный аккаунт. Пароль можно оставить пустым.',
			public: 'Создайте защищённый аккаунт администратора.',
		},
		submit: 'Создать аккаунт',
	},
	login: {
		title: 'Вход в TaleSpinner',
		description: {
			local: 'Выберите локальный аккаунт или введите данные для входа.',
			public: 'Введите имя пользователя и пароль.',
		},
		submit: 'Войти',
	},
	fields: {
		username: 'Имя пользователя',
		displayName: 'Отображаемое имя',
		password: 'Пароль',
		passwordOptional: 'В локальном режиме пароль необязателен',
		setupToken: 'Код первоначальной настройки',
	},
	loading: 'Проверка сессии',
	retry: 'Повторить',
	accounts: {
		title: 'Аккаунты',
		signedInAs: 'Выполнен вход: {{name}}',
		users: 'Пользователи',
		role: 'Роль',
		roles: { user: 'Пользователь', admin: 'Администратор' },
		status: 'Статус',
		statuses: { active: 'Активен', disabled: 'Отключён' },
		create: 'Создать пользователя',
		changeOwnPassword: 'Изменить мой пароль',
		currentPassword: 'Текущий пароль',
		newPassword: 'Новый пароль',
		changePassword: 'Изменить пароль',
		resetPassword: 'Сбросить пароль',
		logout: 'Выйти',
	},
};
