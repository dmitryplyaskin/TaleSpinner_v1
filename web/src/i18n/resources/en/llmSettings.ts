const enLlmSettings = {
			selectSampler: 'Select algorithm',
			actions: {
				save: 'Save template',
				create: 'Create template',
				duplicate: 'Duplicate template',
				delete: 'Delete template',
			},
			fields: {
				temperature: {
					label: 'Temperature',
					tooltip: 'Controls response randomness. Higher values make output more random.',
				},
				maxTokens: {
					label: 'Max tokens',
					tooltip: 'Maximum number of tokens in the model response.',
				},
				topP: {
					label: 'Top P',
					tooltip: 'Controls diversity via nucleus sampling. Lower values make output more focused.',
				},
				frequencyPenalty: {
					label: 'Frequency penalty',
					tooltip: 'Reduces the chance of repeating the same phrases.',
				},
				presencePenalty: {
					label: 'Presence penalty',
					tooltip: 'Encourages the model to introduce new topics.',
				},
			},
		};

export default enLlmSettings;

