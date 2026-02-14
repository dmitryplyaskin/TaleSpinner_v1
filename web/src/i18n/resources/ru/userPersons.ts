const ruUserPersons = {
	fields: {
		name: 'Имя персоны',
		prefix: 'Префикс',
		description: 'Описание',
		baseDescription: 'Базовое описание',
	},
	additional: {
		title: 'Дополнительные описания',
		groupItems: 'Элементы группы',
		disabled: 'Выключено',
		empty: 'Дополнительные описания пока не добавлены',
		emptyGroup: 'В этой группе пока нет элементов',
		fields: {
			itemTitle: 'Название элемента',
			groupTitle: 'Название группы',
			itemText: 'Текст',
		},
		actions: {
			addItem: 'Добавить элемент',
			addGroup: 'Добавить группу',
			expand: 'Развернуть',
			collapse: 'Свернуть',
		},
		defaults: {
			item: 'Элемент {{index}}',
			group: 'Группа {{index}}',
		},
	},
	settings: {
		title: 'Настройки additional',
		additionalJoiner: 'Разделитель',
		wrapperEnabled: 'Включить wrapper',
		wrapperTemplate: 'Шаблон wrapper',
	},
	preview: {
		title: 'Превью итогового описания',
		info: 'Включенных дополнительных блоков: {{count}}',
	},
	badges: {
		active: 'Активная',
	},
	placeholders: {
		searchByName: 'Поиск персоны по имени...',
	},
	filters: {
		showAdvancedTooltip: 'Показать расширенные фильтры',
		hideAdvancedTooltip: 'Скрыть расширенные фильтры',
		sortLabel: 'Сортировка',
		pageSizeLabel: 'На страницу',
	},
	pagination: {
		shownOfTotal: 'Показано {{shown}} из {{total}}',
	},
	empty: {
		noMatches: 'Персоны по текущим фильтрам не найдены',
	},
	editor: {
		title: 'Редактировать персону',
	},
	confirm: {
		deleteTitle: 'Удалить персону?',
		deleteBody: 'Персона "{{name}}" будет удалена без возможности восстановления.',
	},
	toasts: {
		deleteError: 'Не удалось удалить персону',
		saveError: 'Не удалось сохранить персону',
		liquidWarningsTitle: 'Предупреждения Liquid',
		liquidWarningsDescription: 'В шаблонах есть синтаксические ошибки Liquid:\n{{details}}',
		liquidWarningsDescriptionWithMore: 'В шаблонах есть синтаксические ошибки Liquid:\n{{details}}\n... и еще {{more}}',
	},
	defaults: {
		newPerson: 'Новый пользователь',
	},
};

export default ruUserPersons;

