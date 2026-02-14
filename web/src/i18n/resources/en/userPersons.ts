const enUserPersons = {
	fields: {
		name: 'Persona name',
		prefix: 'Prefix',
		description: 'Description',
		baseDescription: 'Base description',
	},
	additional: {
		title: 'Additional descriptions',
		groupItems: 'Group items',
		disabled: 'Disabled',
		empty: 'No additional descriptions yet',
		emptyGroup: 'No items in this group yet',
		fields: {
			itemTitle: 'Item title',
			groupTitle: 'Group title',
			itemText: 'Text',
		},
		actions: {
			addItem: 'Add item',
			addGroup: 'Add group',
			expand: 'Expand',
			collapse: 'Collapse',
		},
		defaults: {
			item: 'Item {{index}}',
			group: 'Group {{index}}',
		},
	},
	settings: {
		title: 'Additional settings',
		additionalJoiner: 'Joiner',
		wrapperEnabled: 'Enable wrapper',
		wrapperTemplate: 'Wrapper template',
	},
	preview: {
		title: 'Final description preview',
		info: 'Enabled additional blocks: {{count}}',
	},
	badges: {
		active: 'Active',
	},
	placeholders: {
		searchByName: 'Search persona by name...',
	},
	filters: {
		showAdvancedTooltip: 'Show advanced filters',
		hideAdvancedTooltip: 'Hide advanced filters',
		sortLabel: 'Sort',
		pageSizeLabel: 'Page size',
	},
	pagination: {
		shownOfTotal: 'Shown {{shown}} of {{total}}',
	},
	empty: {
		noMatches: 'No personas match current filters',
	},
	editor: {
		title: 'Edit Persona',
	},
	confirm: {
		deleteTitle: 'Delete persona?',
		deleteBody: 'Persona "{{name}}" will be deleted permanently.',
	},
	toasts: {
		deleteError: 'Failed to delete persona',
		saveError: 'Failed to save persona',
		liquidWarningsTitle: 'Liquid warnings',
		liquidWarningsDescription: 'Some templates have Liquid syntax issues:\n{{details}}',
		liquidWarningsDescriptionWithMore: 'Some templates have Liquid syntax issues:\n{{details}}\n... and {{more}} more',
	},
	defaults: {
		newPerson: 'New user',
	},
};

export default enUserPersons;

