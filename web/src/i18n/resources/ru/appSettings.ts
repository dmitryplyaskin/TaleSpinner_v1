const ruAppSettings = {
			title: 'Настройки приложения',
			tabs: {
				general: 'Основные',
				theming: 'Темизация',
				debug: 'Debug',
			},
			sections: {
				general: 'Основные настройки',
			},
			theming: {
				mode: 'Режим темы',
				light: 'Светлая',
				dark: 'Тёмная',
				auto: 'Авто',
				activePreset: 'Активный пресет',
				presetName: 'Название пресета',
				presetDescription: 'Описание пресета',
				builtInReadOnly: 'Встроенные пресеты доступны только для чтения. Создайте новый пресет для редактирования.',
				lightTokens: 'Токены (Light)',
				darkTokens: 'Токены (Dark)',
				typography: 'Типографика',
				markdown: 'Markdown стиль',
				customCss: 'Кастомный CSS',
				customCssHint: 'CSS автоматически ограничивается областью приложения.',
				actions: {
					createNew: 'Создать новый',
					createCopy: 'Создать копию',
					import: 'Импорт',
					export: 'Экспорт',
					delete: 'Удалить',
					save: 'Сохранить пресет',
				},
				defaults: {
					newPresetName: 'Новый пресет',
				},
				confirm: {
					deletePreset: 'Удалить выбранный пресет?',
				},
				errors: {
					invalidFormat: 'Неверный формат файла пресета',
				},
				toasts: {
					presetCreated: 'Пресет создан',
					presetSaved: 'Пресет сохранён',
					presetDeleted: 'Пресет удалён',
					createFailed: 'Не удалось создать пресет',
					saveFailed: 'Не удалось сохранить пресет',
					deleteFailed: 'Не удалось удалить пресет',
					importDone: 'Импорт завершён',
					importedCount: 'Импортировано: {{count}}',
					importFailed: 'Не удалось импортировать пресет',
					exportFailed: 'Не удалось экспортировать пресет',
				},
			},
			language: {
				label: 'Язык',
			},
			languages: {
				ru: 'Русский',
				en: 'English',
			},
			openLastChat: {
				label: 'Открывать последний чат',
				info: 'При запуске приложения автоматически открывать последний активный чат',
			},
			autoSelectCurrentPersona: {
				label: 'Автовыбор персоны',
				info: 'Автоматически выбирать актуальную персону в текущем чате',
			},
			debug: {
				label: 'Включить debug-функции чата',
				info: 'Показывает debug UI в чате и включает SSE debug-логи в консоли браузера.',
				logsTitle: 'Фильтры логов консоли',
				logsInfo: 'Выберите, какие типы событий логировать в консоль браузера.',
				actions: {
					enableAll: 'Включить все',
					disableAll: 'Выключить все',
					operationsAndSnapshots: 'Операции + снепшоты',
					resetDefaults: 'Сбросить по умолчанию',
				},
				logs: {
					runLifecycle: {
						label: 'Жизненный цикл запуска',
						description: 'run.started, run.phase_changed, run.finished и сводка run.summary.',
					},
					operationStarted: {
						label: 'Старт операций',
						description: 'operation.started с именем операции и hook.',
					},
					operationFinished: {
						label: 'Завершение операций',
						description: 'operation.finished со статусом и результатом (effects/debugSummary).',
					},
					operationCommits: {
						label: 'Коммиты эффектов',
						description: 'commit.effect_applied/skipped/error.',
					},
					mainLlmLifecycle: {
						label: 'Жизненный цикл main LLM',
						description: 'main_llm.started и main_llm.finished.',
					},
					streamText: {
						label: 'Текстовый стрим',
						description: 'main_llm.delta и llm.stream.delta (токены ответа).',
					},
					streamReasoning: {
						label: 'Стрим рассуждений',
						description: 'main_llm.reasoning_delta и llm.stream.reasoning_delta.',
					},
					streamMeta: {
						label: 'Метаданные стрима',
						description: 'llm.stream.meta с id чата, entry/part и generation.',
					},
					streamDone: {
						label: 'Завершение стрима',
						description: 'llm.stream.done.',
					},
					streamErrors: {
						label: 'Ошибки стрима',
						description: 'llm.stream.error.',
					},
					debugSnapshots: {
						label: 'Debug снепшоты run',
						description: 'run.debug.state_snapshot и run.debug.main_llm_input.',
					},
					templateDebug: {
						label: 'Debug шаблонов операций',
						description: 'operation.debug.template с Liquid-контекстом и рендером.',
					},
					other: {
						label: 'Прочие события',
						description: 'Любые события, не попавшие в категории выше.',
					},
				},
			},
		};

export default ruAppSettings;

