const enInstructions = {
			title: 'Instructions',
			actions: {
				create: 'Create instruction',
				duplicate: 'Duplicate instruction',
				delete: 'Delete instruction',
				prerender: 'Prerender',
			},
			fields: {
				name: 'Name',
				templateText: 'Template (LiquidJS)',
				templateTextDescription: 'Syntax is validated on the backend when saving.',
				advancedMode: 'Advanced mode (ST-compatible)',
				fallbackTemplateText: 'Fallback templateText (basic compatibility)',
				fallbackTemplateTextDescription: 'Used when instruction mode is switched back to basic.',
				prerender: 'Prerender',
				prerenderDescription: 'Liquid render result on backend (without LLM generation).',
				promptBlocks: 'Prompt blocks',
				unsupportedBlock: 'unsupported in runtime',
				responseConfig: 'Response config',
				importSource: 'Import source',
				importFileName: 'Imported file',
				importedAt: 'Imported at',
				rawPreset: 'Raw ST preset (round-trip storage)',
			},
			placeholders: {
				name: 'Enter name',
				selectInstruction: 'Select instruction',
				addPromptBlock: 'Add prompt block',
				promptBlockContent: 'Prompt content',
			},
			defaults: {
				newInstruction: 'New instruction',
				importedInstruction: 'Imported instruction',
			},
			confirm: {
				deleteInstruction: 'Delete instruction?',
				exportStPreset: 'Export ST-compatible preset? (Cancel will export TaleSpinner format)',
				sensitiveRemove: 'Sensitive connection fields were found. Remove them during import?',
				sensitiveImportAsIs: 'Import sensitive fields as-is? (Cancel to abort import)',
			},
			toasts: {
				exportNotPossibleTitle: 'Export not possible',
				selectForExport: 'Select an instruction to export',
				importErrorTitle: 'Import error',
				importMissingTemplateText: 'File does not contain templateText',
				importSuccessTitle: 'Import successful',
				importReadError: 'Failed to read file',
				createErrorTitle: 'Failed to create instruction',
				saveErrorTitle: 'Failed to save instruction',
				deleteErrorTitle: 'Failed to delete instruction',
			},
		};

export default enInstructions;

