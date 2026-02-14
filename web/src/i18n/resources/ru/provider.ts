const ruProvider = {
			providerLabel: 'API provider',
			placeholders: {
				selectProvider: 'Выберите провайдера...',
				selectToken: 'Выберите токен...',
				noTokens: 'Нет токенов',
				selectModel: 'Выберите модель...',
				selectTokenFirst: 'Сначала выберите токен',
			},
			tokens: {
				title: 'Токены',
				manage: 'Управление токенами',
			},
			config: {
				title: 'Конфигурация провайдера',
				baseUrl: 'Base URL',
				defaultModel: 'Модель по умолчанию (опционально)',
				tokenPolicy: {
					title: 'Политика токенов',
					randomize: 'Использовать случайный токен, если токенов больше одного',
					fallbackOnError: 'Fallback на следующий токен при pre-stream ошибках',
				},
				anthropicCache: {
					title: 'Anthropic prompt cache',
					enabled: 'Включить кэш Anthropic/OpenRouter',
					depth: 'Глубина кэша (от хвоста)',
					ttl: 'TTL кэша',
					helpText: 'Глубина считается от последнего сообщения; динамический хвост не кэшируется.',
				},
				save: 'Сохранить конфиг',
			},
			model: {
				title: 'Модель',
				load: 'Загрузить модели',
				manual: 'Ручной id модели',
				manualPlaceholder: 'например anthropic/claude-3.5-sonnet',
				applyManual: 'Применить',
				helpText: 'Если модель не выбрана, будет использоваться `defaultModel` провайдера (если задан) или дефолт провайдера.',
			},
			presets: {
				title: 'LLM пресеты',
				active: 'Активный пресет',
				defaults: {
					newPresetName: 'Новый LLM пресет',
				},
				actions: {
					createPrompt: 'Введите название пресета',
					create: 'Создать',
					save: 'Сохранить',
					duplicate: 'Дублировать',
					apply: 'Применить',
					delete: 'Удалить',
				},
				confirm: {
					delete: 'Удалить выбранный пресет?',
				},
				toasts: {
					created: 'Пресет создан',
					saved: 'Пресет сохранён',
					deleted: 'Пресет удалён',
					applied: 'Пресет применён',
					appliedWithWarnings: 'Пресет применён с предупреждениями',
					failed: 'Ошибка действия пресета',
				},
			},
			toasts: {
				configSaved: 'Конфиг провайдера сохранён',
				configSaveFailed: 'Не удалось сохранить конфиг провайдера',
			},
		};

export default ruProvider;

