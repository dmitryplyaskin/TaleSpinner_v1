const enProvider = {
			providerLabel: 'API provider',
			placeholders: {
				selectProvider: 'Select provider...',
				selectToken: 'Select token...',
				noTokens: 'No tokens',
				selectModel: 'Select model...',
				selectTokenFirst: 'Select a token first',
			},
			tokens: {
				title: 'Tokens',
				manage: 'Manage tokens',
			},
			config: {
				title: 'Provider configuration',
				baseUrl: 'Base URL',
				defaultModel: 'Default model (optional)',
				tokenPolicy: {
					title: 'Token policy',
					randomize: 'Use random token when more than one token exists',
					fallbackOnError: 'Fallback to next token on pre-stream errors',
				},
				anthropicCache: {
					title: 'Anthropic prompt cache',
					enabled: 'Enable Anthropic/OpenRouter prompt cache',
					depth: 'Cache depth (from tail)',
					ttl: 'Cache TTL',
					helpText: 'Depth is measured from the last message; the dynamic tail window stays uncached.',
				},
				save: 'Save config',
			},
			model: {
				title: 'Model',
				load: 'Load models',
				manual: 'Manual model id',
				manualPlaceholder: 'e.g. anthropic/claude-3.5-sonnet',
				applyManual: 'Apply',
				helpText: 'If no model is selected, provider `defaultModel` (if set) or provider default will be used.',
			},
			presets: {
				title: 'LLM presets',
				active: 'Active preset',
				defaults: {
					newPresetName: 'New LLM preset',
				},
				actions: {
					createPrompt: 'Enter preset name',
					create: 'Create',
					save: 'Save',
					duplicate: 'Duplicate',
					apply: 'Apply',
					delete: 'Delete',
				},
				confirm: {
					delete: 'Delete selected preset?',
				},
				toasts: {
					created: 'Preset created',
					saved: 'Preset saved',
					deleted: 'Preset deleted',
					applied: 'Preset applied',
					appliedWithWarnings: 'Preset applied with warnings',
					failed: 'Preset action failed',
				},
			},
			toasts: {
				configSaved: 'Provider config saved',
				configSaveFailed: 'Failed to save provider config',
			},
		};

export default enProvider;

