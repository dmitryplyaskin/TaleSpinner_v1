export default {
	setup: {
		title: 'Create the first account',
		description: {
			local: 'Create a local account. The password may be left empty.',
			public: 'Create a protected administrator account.',
		},
		submit: 'Create account',
	},
	login: {
		title: 'Sign in to TaleSpinner',
		description: {
			local: 'Choose a local account or enter sign-in details.',
			public: 'Enter your username and password.',
		},
		submit: 'Sign in',
	},
	fields: {
		username: 'Username',
		displayName: 'Display name',
		password: 'Password',
		passwordOptional: 'A password is optional in local mode',
		setupToken: 'Initial setup token',
	},
	retry: 'Retry',
	accounts: {
		title: 'Accounts',
		signedInAs: 'Signed in as {{name}}',
		users: 'Users',
		role: 'Role',
		roles: { user: 'User', admin: 'Administrator' },
		create: 'Create user',
		logout: 'Sign out',
	},
};
