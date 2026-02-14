const ruInstructions = {
			title: 'Инструкции',
			actions: {
				create: 'Создать инструкцию',
				duplicate: 'Дублировать инструкцию',
				delete: 'Удалить инструкцию',
				prerender: 'Пререндер',
			},
			fields: {
				name: 'Название',
				templateText: 'Template (LiquidJS)',
				templateTextDescription: 'Синтаксис проверяется на бэкенде при сохранении.',
				advancedMode: 'Расширенный режим (ST-совместимый)',
				fallbackTemplateText: 'Fallback templateText (совместимость basic)',
				fallbackTemplateTextDescription: 'Используется, если режим инструкции переключён обратно на basic.',
				prerender: 'Пререндер',
				prerenderDescription: 'Результат рендера Liquid на бэкенде (без генерации LLM).',
				promptBlocks: 'Блоки промпта',
				unsupportedBlock: 'не поддерживается в runtime',
				responseConfig: 'Параметры ответа',
				importSource: 'Источник импорта',
				importFileName: 'Импортированный файл',
				importedAt: 'Время импорта',
				rawPreset: 'Raw ST preset (для round-trip хранения)',
			},
			placeholders: {
				name: 'Введите название',
				selectInstruction: 'Выберите инструкцию',
				addPromptBlock: 'Добавить блок промпта',
				promptBlockContent: 'Содержимое блока',
			},
			defaults: {
				newInstruction: 'Новая инструкция',
				importedInstruction: 'Импортированная инструкция',
			},
			confirm: {
				deleteInstruction: 'Удалить инструкцию?',
				exportStPreset: 'Экспортировать ST-совместимый пресет? (Отмена экспортирует формат TaleSpinner)',
				sensitiveRemove: 'Найдены чувствительные connection-поля. Удалить их при импорте?',
				sensitiveImportAsIs: 'Импортировать чувствительные поля как есть? (Отмена прерывает импорт)',
			},
			toasts: {
				exportNotPossibleTitle: 'Экспорт невозможен',
				selectForExport: 'Выберите инструкцию для экспорта',
				importErrorTitle: 'Ошибка импорта',
				importMissingTemplateText: 'Файл не содержит templateText',
				importSuccessTitle: 'Импорт успешен',
				importReadError: 'Не удалось прочитать файл',
				createErrorTitle: 'Не удалось создать инструкцию',
				saveErrorTitle: 'Не удалось сохранить инструкцию',
				deleteErrorTitle: 'Не удалось удалить инструкцию',
			},
		};

export default ruInstructions;

