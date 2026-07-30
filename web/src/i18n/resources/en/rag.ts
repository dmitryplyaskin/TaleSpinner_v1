const enRag = {
			providerLabel: 'RAG provider',
			connection: {
				title: 'RAG connection',
				check: 'Check connection',
				success: 'Connection works',
				error: 'Connection error',
			},
			tokens: { title: 'Token', manage: 'Manage tokens' },
			model: {
				title: 'Embedding model',
				manual: 'Embedding model',
				manualPlaceholder: 'e.g. text-embedding-3-small',
				openPicker: 'Open embedding model catalog',
			},
			config: {
				title: 'RAG provider config',
				advancedTitle: 'Advanced settings',
				save: 'Save config',
				fields: {
					baseUrl: 'Base URL',
					defaultModel: 'Default model',
					dimensions: 'Embedding dimensions',
					encodingFormat: 'Encoding format',
					user: 'User identifier',
					keepAlive: 'Keep model loaded for',
					truncate: 'Truncate input that is too long',
				},
			},
			placeholders: {
				selectToken: 'Select a token',
				noTokens: 'No saved tokens',
				selectModel: 'Select a model',
			},
			actions: {
				reset: 'Reset',
				saveChanges: 'Save changes',
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
					delete: 'Delete',
				},
				confirm: {
					delete: 'Delete selected preset?',
					discardChanges: 'You have unsaved changes. Discard them and switch preset?',
				},
				toasts: {
					created: 'RAG preset created',
					saved: 'RAG preset saved',
					deleted: 'RAG preset deleted',
					applied: 'RAG preset applied',
					failed: 'Failed to update RAG preset',
				},
			},
			toasts: {
				configSaved: 'RAG config saved',
				configSaveFailed: 'Failed to save RAG config',
				modelsEmpty: 'The provider returned no embedding models',
				incompleteConnection: 'Select a model and fill in the required fields',
				connectionSaved: 'RAG settings saved',
				connectionSaveFailed: 'Failed to save RAG settings',
				connectionCheckFailed: 'Failed to check the RAG connection',
			},
		};

export default enRag;

