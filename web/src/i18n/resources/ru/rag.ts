const ruRag = {
			providerLabel: 'RAG провайдер',
			connection: {
				title: 'Подключение RAG',
				check: 'Проверить подключение',
				success: 'Подключение работает',
				error: 'Ошибка подключения',
			},
			tokens: { title: 'Токен', manage: 'Управление токенами' },
			model: {
				title: 'Модель эмбеддингов',
				manual: 'Модель эмбеддингов',
				manualPlaceholder: 'например text-embedding-3-small',
				openPicker: 'Открыть каталог моделей эмбеддингов',
			},
			config: {
				title: 'Конфигурация RAG провайдера',
				advancedTitle: 'Расширенные настройки',
				save: 'Сохранить конфиг',
				fields: {
					baseUrl: 'Базовый URL',
					defaultModel: 'Модель по умолчанию',
					dimensions: 'Размерность эмбеддингов',
					encodingFormat: 'Формат кодирования',
					user: 'Идентификатор пользователя',
					keepAlive: 'Время хранения модели в памяти',
					truncate: 'Обрезать слишком длинный ввод',
				},
			},
			placeholders: {
				selectToken: 'Выберите токен',
				noTokens: 'Нет сохранённых токенов',
				selectModel: 'Выберите модель',
			},
			actions: {
				reset: 'Сбросить',
				saveChanges: 'Сохранить изменения',
			},
			presets: {
				title: 'RAG пресеты',
				active: 'Активный пресет',
				defaults: { newPresetName: 'Новый RAG пресет' },
				actions: {
					createPrompt: 'Введите название пресета',
					renamePrompt: 'Введите новое название пресета',
					create: 'Создать',
					rename: 'Переименовать',
					save: 'Сохранить',
					duplicate: 'Дублировать',
					delete: 'Удалить',
				},
				confirm: {
					delete: 'Удалить выбранный пресет?',
					discardChanges: 'Есть несохранённые изменения. Отменить их и переключить пресет?',
				},
				toasts: {
					created: 'RAG пресет создан',
					saved: 'RAG пресет сохранён',
					deleted: 'RAG пресет удалён',
					applied: 'RAG пресет применён',
					failed: 'Не удалось изменить RAG пресет',
				},
			},
			toasts: {
				configSaved: 'RAG конфиг сохранён',
				configSaveFailed: 'Не удалось сохранить RAG конфиг',
				modelsEmpty: 'Провайдер не вернул модели эмбеддингов',
				incompleteConnection: 'Выберите модель и заполните обязательные поля',
				connectionSaved: 'Настройки RAG сохранены',
				connectionSaveFailed: 'Не удалось сохранить настройки RAG',
				connectionCheckFailed: 'Не удалось проверить подключение RAG',
			},
		};

export default ruRag;

