const ruRag = {
			providerLabel: 'RAG провайдер',
			tokens: { title: 'Токен' },
			model: {
				manual: 'Модель эмбеддингов',
				manualPlaceholder: 'например text-embedding-3-small',
			},
			config: {
				title: 'Конфигурация RAG провайдера',
				save: 'Сохранить конфиг',
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
					apply: 'Применить',
					delete: 'Удалить',
				},
				confirm: { delete: 'Удалить выбранный пресет?' },
			},
			toasts: {
				configSaved: 'RAG конфиг сохранён',
				configSaveFailed: 'Не удалось сохранить RAG конфиг',
			},
		};

export default ruRag;

