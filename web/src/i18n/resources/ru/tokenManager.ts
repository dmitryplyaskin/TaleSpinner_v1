const ruTokenManager = {
	title: 'Менеджер ключей',
	titleWithProvider: 'API-ключи · {{providerName}}',
	addToken: 'Добавить ключ',
	addFirst: 'Добавить первый ключ',
	savedTitle: 'Сохранённые ключи',
	savedHint: 'Значения ключей зашифрованы и после сохранения не отображаются.',
	emptyTitle: 'Ключей пока нет',
	empty: 'Добавьте API-ключ, чтобы подключить модели этого провайдера.',
	active: 'Выбран',
	use: 'Выбрать',
	actions: 'Действия с ключом',
	lastUsed: 'Последнее использование: {{value}}',
	editToken: 'Редактировать ключ',
	createHint: 'Дайте ключу понятное имя — например, «Основной» или «Резервный».',
	editHint: 'Можно переименовать ключ или заменить его значение.',
	deleteConfirmTitle: 'Удалить API-ключ?',
	deleteConfirmText: 'Ключ «{{name}}» будет удалён. Связанные подключения останутся без выбранного ключа.',
	fields: {
		name: 'Название',
		token: 'API-ключ',
		newToken: 'Новый API-ключ (опционально)',
		currentHint: 'Текущее значение: {{hint}}',
	},
	toasts: {
		created: 'API-ключ добавлен',
		saved: 'API-ключ обновлён',
		deleted: 'API-ключ удалён',
		failed: 'Не удалось изменить API-ключ',
	},
};

export default ruTokenManager;
