const ruDialogs = {
			textarea: {
				openFullscreen: 'Открыть в полном экране',
				title: 'Редактирование',
				tabs: {
					edit: 'Редактировать',
					preview: 'Предпросмотр',
				},
			},
			liquidDocs: {
				open: 'Открыть документацию Liquid',
				sections: {
					usage: 'Где используется',
					variables: 'Переменные',
					macros: 'Макросы',
					examples: 'Примеры',
				},
				contexts: {
					instruction: {
						title: 'Liquid для инструкций',
						usage: 'Используется при рендере инструкций чата перед генерацией.',
					},
					operationTemplate: {
						title: 'Liquid для template-операции',
						usage: 'Используется в operation kind=template для рендера payload эффектов.',
					},
					operationLlm: {
						title: 'Liquid для llm-операции',
						usage: 'Используется в operation kind=llm для рендера system и user prompt.',
					},
					entityProfile: {
						title: 'Liquid для полей профиля',
						usage: 'Liquid может раскрываться в текстовых полях профиля напрямую и косвенно через multi-pass в других шаблонах.',
					},
					worldInfoEntry: {
						title: 'Liquid для World Info',
						usage: 'Используется при рендере content записей World Info в runtime-контексте.',
					},
					chatManualEdit: {
						title: 'Liquid для ручного редактирования',
						usage: 'Используется при ручном редактировании части сообщения и рендере через Liquid.',
					},
				},
				variables: {
					char: 'Алиас объекта персонажа. Работает как строка и как объект.',
					charName: 'Имя персонажа из текущего entity profile.',
					user: 'Алиас объекта выбранной пользовательской персоны.',
					userName: 'Имя выбранной пользовательской персоны.',
					chatId: 'Идентификатор текущего чата.',
					chatTitle: 'Название текущего чата.',
					messages: 'История prompt-сообщений в виде массива { role, content }.',
					lastUserMessage: 'Последнее user-сообщение из массива messages.',
					lastAssistantMessage:
						'Последнее assistant-сообщение из массива messages. До main LLM это прошлый ответ ассистента, после main LLM это свежесгенерированный ответ.',
					now: 'Текущая ISO-метка времени с сервера.',
					rag: 'Зарезервированный объект retrieval-контекста.',
					description: 'Алиас для char.description.',
					scenario: 'Алиас для char.scenario.',
					personality: 'Алиас для char.personality.',
					system: 'Алиас для char.system_prompt.',
					persona: 'Алиас для описания пользовательской персоны.',
					mesExamples: 'Алиас для поля примеров сообщений персонажа.',
					mesExamplesRaw: 'Сырое поле примеров сообщений персонажа до преобразований.',
					anchorBefore: 'Алиас для блока world info anchor before.',
					anchorAfter: 'Алиас для блока world info anchor after.',
					wiBefore: 'Текст World Info, вставляемый до основной истории/системы.',
					wiAfter: 'Текст World Info, вставляемый после основной истории/системы.',
					loreBefore: 'Алиас для блока World Info before.',
					loreAfter: 'Алиас для блока World Info after.',
					outlet: 'Склеенная map outlet, ключ -> текст.',
					outletEntries: 'Map outlet, ключ -> массив отрендеренных блоков.',
					anTop: 'Массив Author Note вставок для верхней позиции.',
					anBottom: 'Массив Author Note вставок для нижней позиции.',
					emTop: 'Массив Extension Memory вставок для верхней позиции.',
					emBottom: 'Массив Extension Memory вставок для нижней позиции.',
					promptSystem: 'Итоговый system prompt в контексте операций.',
					art: 'Map артефактов операций по тегам.',
					artValue: 'Значение артефакта по тегу, например art.note.value.',
				},
				macros: {
					trim: 'Удаляет лишние пустые строки вокруг позиции макроса.',
					outlet: 'Короткая форма доступа к outlet по ключу.',
					random: 'Выбирает один вариант при рендере и вставляет его.',
				},
				examples: {
					instructionSystem: {
						title: 'System шаблон с World Info',
					},
					instructionOutlet: {
						title: 'Outlet плюс случайный тон',
					},
					operationTemplateArtifacts: {
						title: 'Чтение promptSystem и артефактов',
					},
					operationTemplatePromptTime: {
						title: 'Сборка payload для prompt-time',
					},
					operationLlmSystem: {
						title: 'LLM system шаблон',
					},
					operationLlmPrompt: {
						title: 'LLM user prompt шаблон',
					},
					entityProfileGreeting: {
						title: 'Шаблон приветствия',
					},
					entityProfileIndirect: {
						title: 'Косвенное multi-pass использование профиля',
					},
					worldInfoEntryCharacter: {
						title: 'Строка World Info с учетом персонажа',
					},
					worldInfoEntryOutlet: {
						title: 'Слияние outlet в World Info',
					},
					chatManualEditRewrite: {
						title: 'Шаблон переписывания при ручном редактировании',
					},
					chatManualEditHistory: {
						title: 'Шаблон с учетом истории при ручном редактировании',
					},
				},
			},
		};

export default ruDialogs;

