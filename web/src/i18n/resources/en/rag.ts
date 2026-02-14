const enRag = {
			providerLabel: 'RAG provider',
			tokens: { title: 'Token' },
			model: {
				manual: 'Embedding model',
				manualPlaceholder: 'e.g. text-embedding-3-small',
			},
			config: {
				title: 'RAG provider config',
				save: 'Save config',
			},
			presets: {
				title: 'RAG presets',
				active: 'Active preset',
				defaults: { newPresetName: 'New RAG preset' },
				actions: {
					createPrompt: 'Enter preset name',
					renamePrompt: 'Enter new preset name',
					create: 'Create',
					rename: 'Rename',
					save: 'Save',
					duplicate: 'Duplicate',
					apply: 'Apply',
					delete: 'Delete',
				},
				confirm: { delete: 'Delete selected preset?' },
			},
			toasts: {
				configSaved: 'RAG config saved',
				configSaveFailed: 'Failed to save RAG config',
			},
		};

export default enRag;

