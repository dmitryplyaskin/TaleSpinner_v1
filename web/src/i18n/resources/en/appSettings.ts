const enAppSettings = {
			title: 'App settings',
			tabs: {
				general: 'General',
				theming: 'Theming',
				debug: 'Debug',
			},
			sections: {
				general: 'General settings',
			},
			theming: {
				mode: 'Theme mode',
				light: 'Light',
				dark: 'Dark',
				auto: 'Auto',
				activePreset: 'Active preset',
				presetName: 'Preset name',
				presetDescription: 'Preset description',
				builtInReadOnly: 'Built-in presets are read-only. Create a new preset to edit.',
				lightTokens: 'Tokens (Light)',
				darkTokens: 'Tokens (Dark)',
				typography: 'Typography',
				markdown: 'Markdown style',
				customCss: 'Custom CSS',
				customCssHint: 'CSS is automatically scoped to the app shell.',
				actions: {
					createNew: 'Create new',
					createCopy: 'Create copy',
					import: 'Import',
					export: 'Export',
					delete: 'Delete',
					save: 'Save preset',
				},
				defaults: {
					newPresetName: 'New preset',
				},
				confirm: {
					deletePreset: 'Delete selected preset?',
				},
				errors: {
					invalidFormat: 'Invalid preset file format',
				},
				toasts: {
					presetCreated: 'Preset created',
					presetSaved: 'Preset saved',
					presetDeleted: 'Preset deleted',
					createFailed: 'Failed to create preset',
					saveFailed: 'Failed to save preset',
					deleteFailed: 'Failed to delete preset',
					importDone: 'Import completed',
					importedCount: 'Imported: {{count}}',
					importFailed: 'Failed to import preset',
					exportFailed: 'Failed to export preset',
				},
			},
			language: {
				label: 'Language',
			},
			languages: {
				ru: 'Russian',
				en: 'English',
			},
			openLastChat: {
				label: 'Open last chat',
				info: 'Automatically open the last active chat when the app starts',
			},
			autoSelectCurrentPersona: {
				label: 'Auto-select persona',
				info: 'Automatically select the relevant persona in the current chat',
			},
			debug: {
				label: 'Enable chat debug features',
				info: 'Shows debug UI in chat and enables SSE debug logs in browser console.',
				logsTitle: 'Console log filters',
				logsInfo: 'Choose which event types should be logged to the browser console.',
				actions: {
					enableAll: 'Enable all',
					disableAll: 'Disable all',
					operationsAndSnapshots: 'Operations + snapshots',
					resetDefaults: 'Reset defaults',
				},
				logs: {
					runLifecycle: {
						label: 'Run lifecycle',
						description: 'run.started, run.phase_changed, run.finished, and run.summary.',
					},
					operationStarted: {
						label: 'Operation started',
						description: 'operation.started with operation name and hook.',
					},
					operationFinished: {
						label: 'Operation finished',
						description: 'operation.finished with status and operation result (effects/debugSummary).',
					},
					operationCommits: {
						label: 'Effect commits',
						description: 'commit.effect_applied/skipped/error.',
					},
					mainLlmLifecycle: {
						label: 'Main LLM lifecycle',
						description: 'main_llm.started and main_llm.finished.',
					},
					streamText: {
						label: 'Text stream',
						description: 'main_llm.delta and llm.stream.delta (response tokens).',
					},
					streamReasoning: {
						label: 'Reasoning stream',
						description: 'main_llm.reasoning_delta and llm.stream.reasoning_delta.',
					},
					streamMeta: {
						label: 'Stream metadata',
						description: 'llm.stream.meta with chat, entry/part, and generation ids.',
					},
					streamDone: {
						label: 'Stream completion',
						description: 'llm.stream.done.',
					},
					streamErrors: {
						label: 'Stream errors',
						description: 'llm.stream.error.',
					},
					debugSnapshots: {
						label: 'Run debug snapshots',
						description: 'run.debug.state_snapshot and run.debug.main_llm_input.',
					},
					templateDebug: {
						label: 'Operation template debug',
						description: 'operation.debug.template with Liquid context and rendered output.',
					},
					other: {
						label: 'Other events',
						description: 'Any events that do not match categories above.',
					},
				},
			},
		};

export default enAppSettings;

