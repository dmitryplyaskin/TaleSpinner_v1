const enDialogs = {
			textarea: {
				openFullscreen: 'Open fullscreen',
				title: 'Editing',
				tabs: {
					edit: 'Edit',
					preview: 'Preview',
				},
			},
			liquidDocs: {
				open: 'Open Liquid docs',
				sections: {
					usage: 'Usage',
					variables: 'Variables',
					macros: 'Macros',
					examples: 'Examples',
				},
				contexts: {
					instruction: {
						title: 'Instruction Liquid docs',
						usage: 'Used when rendering chat instructions before generation.',
					},
					operationTemplate: {
						title: 'Template operation Liquid docs',
						usage: 'Used by operation kind=template for rendered effect payloads.',
					},
					operationLlm: {
						title: 'LLM operation Liquid docs',
						usage: 'Used by operation kind=llm for system and user prompt rendering.',
					},
					entityProfile: {
						title: 'Entity profile Liquid docs',
						usage: 'Liquid can be resolved in profile text fields directly and through multi-pass usage in other templates.',
					},
					worldInfoEntry: {
						title: 'World Info Liquid docs',
						usage: 'Used when rendering World Info entry content in runtime context.',
					},
					chatManualEdit: {
						title: 'Manual edit Liquid docs',
						usage: 'Used when chat message part is edited manually and rendered via Liquid.',
					},
				},
				variables: {
					char: 'Character object alias. Works as string and as object.',
					charName: 'Character name from current entity profile.',
					user: 'Selected user persona object alias.',
					userName: 'Selected user persona name.',
					chatId: 'Current chat identifier.',
					chatTitle: 'Current chat title.',
					messages: 'Prompt-visible history as array of { role, content }.',
					now: 'Current ISO timestamp generated on server.',
					rag: 'Reserved retrieval context object.',
					description: 'Alias for char.description.',
					scenario: 'Alias for char.scenario.',
					personality: 'Alias for char.personality.',
					system: 'Alias for char.system_prompt.',
					persona: 'Alias for user persona description.',
					mesExamples: 'Alias for character example messages field.',
					mesExamplesRaw: 'Raw character example messages field before transforms.',
					anchorBefore: 'Alias for world info anchor before block.',
					anchorAfter: 'Alias for world info anchor after block.',
					wiBefore: 'World Info text inserted before history/system area.',
					wiAfter: 'World Info text inserted after history/system area.',
					loreBefore: 'Alias for World Info before block.',
					loreAfter: 'Alias for World Info after block.',
					outlet: 'Joined outlet map, key to rendered text.',
					outletEntries: 'Outlet map, key to array of raw rendered blocks.',
					anTop: 'Author note entries for top insertion.',
					anBottom: 'Author note entries for bottom insertion.',
					emTop: 'Extension memory entries for top insertion.',
					emBottom: 'Extension memory entries for bottom insertion.',
					promptSystem: 'Resolved system prompt visible in operation context.',
					art: 'Operation artifacts map by tag.',
					artValue: 'Artifact value by tag, for example art.note.value.',
				},
				macros: {
					trim: 'Removes surrounding blank lines around macro location.',
					outlet: 'Shortcut to outlet map lookup by key.',
					random: 'Chooses one option at render time and inserts text.',
				},
				examples: {
					instructionSystem: {
						title: 'System template with world info',
					},
					instructionOutlet: {
						title: 'Outlet plus random tone',
					},
					operationTemplateArtifacts: {
						title: 'Read promptSystem and artifacts',
					},
					operationTemplatePromptTime: {
						title: 'Compose prompt-time payload',
					},
					operationLlmSystem: {
						title: 'LLM system template',
					},
					operationLlmPrompt: {
						title: 'LLM user prompt template',
					},
					entityProfileGreeting: {
						title: 'Greeting template',
					},
					entityProfileIndirect: {
						title: 'Indirect multi-pass profile usage',
					},
					worldInfoEntryCharacter: {
						title: 'World Info character-aware line',
					},
					worldInfoEntryOutlet: {
						title: 'World Info outlet merge',
					},
					chatManualEditRewrite: {
						title: 'Manual edit rewrite template',
					},
					chatManualEditHistory: {
						title: 'Manual edit history-aware template',
					},
				},
			},
		};

export default enDialogs;

