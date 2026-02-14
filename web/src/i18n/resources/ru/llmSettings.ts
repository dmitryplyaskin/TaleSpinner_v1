const ruLlmSettings = {
			selectSampler: 'Выберите алгоритм',
			actions: {
				save: 'Сохранить шаблон',
				create: 'Создать шаблон',
				duplicate: 'Дублировать шаблон',
				delete: 'Удалить шаблон',
			},
			fields: {
				temperature: {
					label: 'Температура',
					tooltip: 'Контролирует случайность ответов. Более высокие значения делают вывод более случайным.',
				},
				maxTokens: {
					label: 'Максимум токенов',
					tooltip: 'Максимальное количество токенов в ответе модели.',
				},
				topP: {
					label: 'Top P',
					tooltip: 'Контролирует разнообразие через nucleus sampling. Меньшие значения делают вывод более сфокусированным.',
				},
				frequencyPenalty: {
					label: 'Штраф частоты',
					tooltip: 'Снижает вероятность повторения одних и тех же фраз.',
				},
				presencePenalty: {
					label: 'Штраф присутствия',
					tooltip: 'Поощряет модель говорить о новых темах.',
				},
			},
		};

export default ruLlmSettings;

