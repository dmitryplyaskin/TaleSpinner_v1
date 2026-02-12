export type LiquidDocsContextId =
	| 'prompt_template'
	| 'operation_template'
	| 'operation_llm'
	| 'entity_profile'
	| 'world_info_entry'
	| 'chat_manual_edit';

export type VariableDoc = {
	token: string;
	descriptionKey: string;
};

export type MacroDoc = {
	token: string;
	descriptionKey: string;
};

export type ExampleDoc = {
	titleKey: string;
	template: string;
};

export type LiquidDocsModel = {
	titleKey: string;
	usageKey: string;
	variables: VariableDoc[];
	macros: MacroDoc[];
	examples: ExampleDoc[];
};

const BASE_VARIABLES: VariableDoc[] = [
	{ token: '{{char}}', descriptionKey: 'dialogs.liquidDocs.variables.char' },
	{ token: '{{char.name}}', descriptionKey: 'dialogs.liquidDocs.variables.charName' },
	{ token: '{{user}}', descriptionKey: 'dialogs.liquidDocs.variables.user' },
	{ token: '{{user.name}}', descriptionKey: 'dialogs.liquidDocs.variables.userName' },
	{ token: '{{chat.id}}', descriptionKey: 'dialogs.liquidDocs.variables.chatId' },
	{ token: '{{chat.title}}', descriptionKey: 'dialogs.liquidDocs.variables.chatTitle' },
	{ token: '{{messages}}', descriptionKey: 'dialogs.liquidDocs.variables.messages' },
	{ token: '{{now}}', descriptionKey: 'dialogs.liquidDocs.variables.now' },
	{ token: '{{rag}}', descriptionKey: 'dialogs.liquidDocs.variables.rag' },
	{ token: '{{description}}', descriptionKey: 'dialogs.liquidDocs.variables.description' },
	{ token: '{{scenario}}', descriptionKey: 'dialogs.liquidDocs.variables.scenario' },
	{ token: '{{personality}}', descriptionKey: 'dialogs.liquidDocs.variables.personality' },
	{ token: '{{system}}', descriptionKey: 'dialogs.liquidDocs.variables.system' },
	{ token: '{{persona}}', descriptionKey: 'dialogs.liquidDocs.variables.persona' },
	{ token: '{{mesExamples}}', descriptionKey: 'dialogs.liquidDocs.variables.mesExamples' },
	{ token: '{{mesExamplesRaw}}', descriptionKey: 'dialogs.liquidDocs.variables.mesExamplesRaw' },
	{ token: '{{anchorBefore}}', descriptionKey: 'dialogs.liquidDocs.variables.anchorBefore' },
	{ token: '{{anchorAfter}}', descriptionKey: 'dialogs.liquidDocs.variables.anchorAfter' },
	{ token: '{{wiBefore}}', descriptionKey: 'dialogs.liquidDocs.variables.wiBefore' },
	{ token: '{{wiAfter}}', descriptionKey: 'dialogs.liquidDocs.variables.wiAfter' },
	{ token: '{{loreBefore}}', descriptionKey: 'dialogs.liquidDocs.variables.loreBefore' },
	{ token: '{{loreAfter}}', descriptionKey: 'dialogs.liquidDocs.variables.loreAfter' },
	{ token: "{{outlet['default']}}", descriptionKey: 'dialogs.liquidDocs.variables.outlet' },
	{ token: '{{outletEntries.default}}', descriptionKey: 'dialogs.liquidDocs.variables.outletEntries' },
	{ token: '{{anTop}}', descriptionKey: 'dialogs.liquidDocs.variables.anTop' },
	{ token: '{{anBottom}}', descriptionKey: 'dialogs.liquidDocs.variables.anBottom' },
	{ token: '{{emTop}}', descriptionKey: 'dialogs.liquidDocs.variables.emTop' },
	{ token: '{{emBottom}}', descriptionKey: 'dialogs.liquidDocs.variables.emBottom' },
];

const OPERATION_VARIABLES: VariableDoc[] = [
	{ token: '{{promptSystem}}', descriptionKey: 'dialogs.liquidDocs.variables.promptSystem' },
	{ token: '{{art}}', descriptionKey: 'dialogs.liquidDocs.variables.art' },
	{ token: '{{art.note.value}}', descriptionKey: 'dialogs.liquidDocs.variables.artValue' },
];

const COMMON_MACROS: MacroDoc[] = [
	{ token: '{{trim}}', descriptionKey: 'dialogs.liquidDocs.macros.trim' },
	{ token: '{{outlet::default}}', descriptionKey: 'dialogs.liquidDocs.macros.outlet' },
	{ token: '{{random::A::B::C}}', descriptionKey: 'dialogs.liquidDocs.macros.random' },
];

export const LIQUID_DOCS_BY_CONTEXT: Record<LiquidDocsContextId, LiquidDocsModel> = {
	prompt_template: {
		titleKey: 'dialogs.liquidDocs.contexts.promptTemplate.title',
		usageKey: 'dialogs.liquidDocs.contexts.promptTemplate.usage',
		variables: BASE_VARIABLES,
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.promptTemplateSystem.title',
				template:
					'You are {{char.name}}.\nScenario: {{scenario}}\n\n{{wiBefore}}\n{{trim}}\n{{wiAfter}}',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.promptTemplateOutlet.title',
				template: "Memory:\n{{outlet::default}}\nTone: {{random::calm::tense::neutral}}",
			},
		],
	},
	operation_template: {
		titleKey: 'dialogs.liquidDocs.contexts.operationTemplate.title',
		usageKey: 'dialogs.liquidDocs.contexts.operationTemplate.usage',
		variables: [...BASE_VARIABLES, ...OPERATION_VARIABLES],
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.operationTemplateArtifacts.title',
				template: 'Current system:\n{{promptSystem}}\n\nNote artifact:\n{{art.note.value}}',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.operationTemplatePromptTime.title',
				template: 'Inject after user:\nCharacter={{char.name}}\nPersona={{user.name}}',
			},
		],
	},
	operation_llm: {
		titleKey: 'dialogs.liquidDocs.contexts.operationLlm.title',
		usageKey: 'dialogs.liquidDocs.contexts.operationLlm.usage',
		variables: [...BASE_VARIABLES, ...OPERATION_VARIABLES],
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.operationLlmSystem.title',
				template: 'System role for {{char.name}}.\nKeep consistency with {{promptSystem}}.',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.operationLlmPrompt.title',
				template: 'User asks for next step.\nLast messages count: {{messages | size}}',
			},
		],
	},
	entity_profile: {
		titleKey: 'dialogs.liquidDocs.contexts.entityProfile.title',
		usageKey: 'dialogs.liquidDocs.contexts.entityProfile.usage',
		variables: BASE_VARIABLES,
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.entityProfileGreeting.title',
				template: 'Hi {{user.name}}, I am {{char.name}}.',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.entityProfileIndirect.title',
				template: '{{description}}\n{{scenario}}',
			},
		],
	},
	world_info_entry: {
		titleKey: 'dialogs.liquidDocs.contexts.worldInfoEntry.title',
		usageKey: 'dialogs.liquidDocs.contexts.worldInfoEntry.usage',
		variables: BASE_VARIABLES,
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.worldInfoEntryCharacter.title',
				template: 'World rule for {{char.name}}: keep {{persona}} tone.',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.worldInfoEntryOutlet.title',
				template: 'Outlet merge:\n{{outlet::default}}\n{{trim}}\n{{wiAfter}}',
			},
		],
	},
	chat_manual_edit: {
		titleKey: 'dialogs.liquidDocs.contexts.chatManualEdit.title',
		usageKey: 'dialogs.liquidDocs.contexts.chatManualEdit.usage',
		variables: BASE_VARIABLES,
		macros: COMMON_MACROS,
		examples: [
			{
				titleKey: 'dialogs.liquidDocs.examples.chatManualEditRewrite.title',
				template: '{{user.name}} rewrites this message in style of {{char.name}}.',
			},
			{
				titleKey: 'dialogs.liquidDocs.examples.chatManualEditHistory.title',
				template: 'History items: {{messages | size}}\n{{random::short::detailed}} reply.',
			},
		],
	},
};
