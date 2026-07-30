const enTokenManager = {
	title: 'Key manager',
	titleWithProvider: 'API keys · {{providerName}}',
	addToken: 'Add key',
	addFirst: 'Add first key',
	savedTitle: 'Saved keys',
	savedHint: 'Key values are encrypted and cannot be displayed after saving.',
	emptyTitle: 'No keys yet',
	empty: 'Add an API key to connect models from this provider.',
	active: 'Selected',
	use: 'Select',
	actions: 'Key actions',
	lastUsed: 'Last used: {{value}}',
	editToken: 'Edit key',
	createHint: 'Use a recognizable name such as “Primary” or “Backup”.',
	editHint: 'Rename the key or replace its value.',
	deleteConfirmTitle: 'Delete API key?',
	deleteConfirmText: '“{{name}}” will be deleted. Connections using it will remain without a selected key.',
	fields: {
		name: 'Name',
		token: 'API key',
		newToken: 'New API key (optional)',
		currentHint: 'Current value: {{hint}}',
	},
	toasts: {
		created: 'API key added',
		saved: 'API key updated',
		deleted: 'API key deleted',
		failed: 'Failed to change API key',
	},
};

export default enTokenManager;
