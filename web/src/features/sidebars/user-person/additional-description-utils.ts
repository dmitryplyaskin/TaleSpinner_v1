import {
	type UserPersonContentTypeExtended,
	type UserPersonContentTypeExtendedLegacyItem,
	type UserPersonContentTypeExtendedV2,
	type UserPersonContentTypeExtendedV2Block,
	type UserPersonContentTypeExtendedV2Group,
	type UserPersonContentTypeExtendedV2Item,
} from '@shared/types/user-person';

const DEFAULT_ADDITIONAL_JOINER = '\\n\\n';
const DEFAULT_WRAPPER_TEMPLATE = '<tag>{{PROMPT}}</tag>';
const WRAPPER_PLACEHOLDER = '{{PROMPT}}';
const CONTENT_TYPE_EXTENDED_VERSION = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function makeId(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAdvancedState(value: unknown): UserPersonContentTypeExtendedV2Item['adv'] {
	if (!isRecord(value)) return undefined;
	const connectionsRaw = isRecord(value.connections) ? value.connections : {};
	const matchRaw = isRecord(value.match) ? value.match : {};
	return {
		advancedOpen: typeof value.advancedOpen === 'boolean' ? value.advancedOpen : false,
		connections: {
			enabled: typeof connectionsRaw.enabled === 'boolean' ? connectionsRaw.enabled : false,
			chats: Array.isArray(connectionsRaw.chats) ? connectionsRaw.chats.map((x) => String(x ?? '')).filter(Boolean) : [],
			entities: Array.isArray(connectionsRaw.entities) ? connectionsRaw.entities.map((x) => String(x ?? '')).filter(Boolean) : [],
		},
		match: {
			enabled: typeof matchRaw.enabled === 'boolean' ? matchRaw.enabled : false,
			query: typeof matchRaw.query === 'string' ? matchRaw.query : '',
		},
	};
}

function normalizeItem(value: unknown, fallbackTitle: string): UserPersonContentTypeExtendedV2Item {
	const src = isRecord(value) ? value : {};
	return {
		type: 'item',
		id: asString(src.id).trim() || makeId('pme_item'),
		title: asString(src.title, fallbackTitle).trim() || fallbackTitle,
		text: asString(src.text),
		enabled: asBoolean(src.enabled, true),
		collapsed: asBoolean(src.collapsed, false),
		adv: normalizeAdvancedState(src.adv),
	};
}

function normalizeGroup(value: unknown, fallbackTitle: string): UserPersonContentTypeExtendedV2Group {
	const src = isRecord(value) ? value : {};
	const rawItems = Array.isArray(src.items) ? src.items : [];
	const items = rawItems.map((item, idx) => normalizeItem(item, `Item ${idx + 1}`));
	return {
		type: 'group',
		id: asString(src.id).trim() || makeId('pme_group'),
		title: asString(src.title, fallbackTitle).trim() || fallbackTitle,
		enabled: asBoolean(src.enabled, true),
		collapsed: asBoolean(src.collapsed, false),
		items,
		adv: normalizeAdvancedState(src.adv),
	};
}

function normalizeBlock(value: unknown, index: number): UserPersonContentTypeExtendedV2Block {
	const src = isRecord(value) ? value : {};
	const type = asString(src.type, '').trim().toLowerCase();
	if (type === 'group' || Array.isArray(src.items)) {
		return normalizeGroup(src, `Group ${index + 1}`);
	}
	return normalizeItem(src, `Item ${index + 1}`);
}

function normalizeLegacyBlocks(items: UserPersonContentTypeExtendedLegacyItem[]): UserPersonContentTypeExtendedV2Block[] {
	return items.map((item, index) =>
		normalizeItem(
			{
				id: item.id,
				title: item.name ?? item.tagName ?? `Item ${index + 1}`,
				text: item.value,
				enabled: item.isEnabled,
				collapsed: false,
			},
			`Item ${index + 1}`,
		),
	);
}

function normalizeSettings(value: unknown): UserPersonContentTypeExtendedV2['settings'] {
	const src = isRecord(value) ? value : {};
	return {
		additionalJoiner: typeof src.additionalJoiner === 'string' ? src.additionalJoiner : DEFAULT_ADDITIONAL_JOINER,
		wrapperEnabled: src.wrapperEnabled === true,
		wrapperTemplate: typeof src.wrapperTemplate === 'string' ? src.wrapperTemplate : DEFAULT_WRAPPER_TEMPLATE,
	};
}

function looksLikeLegacyArrayEntry(value: unknown): value is UserPersonContentTypeExtendedLegacyItem {
	if (!isRecord(value)) return false;
	return typeof value.value === 'string' && typeof value.isEnabled === 'boolean';
}

export function createDefaultContentTypeExtended(baseDescription = ''): UserPersonContentTypeExtendedV2 {
	return {
		version: CONTENT_TYPE_EXTENDED_VERSION,
		baseDescription,
		settings: normalizeSettings(undefined),
		blocks: [],
	};
}

export function normalizeContentTypeExtended(params: {
	contentTypeExtended?: UserPersonContentTypeExtended | unknown;
	contentTypeDefault?: string;
}): UserPersonContentTypeExtendedV2 {
	const baseDescriptionFallback = typeof params.contentTypeDefault === 'string' ? params.contentTypeDefault : '';
	const raw = params.contentTypeExtended;

	if (isRecord(raw)) {
		const baseDescription = asString(raw.baseDescription, baseDescriptionFallback);
		const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];
		const blocks = blocksRaw.map((block, idx) => normalizeBlock(block, idx));
		return {
			version: CONTENT_TYPE_EXTENDED_VERSION,
			baseDescription,
			settings: normalizeSettings(raw.settings),
			blocks,
		};
	}

	if (Array.isArray(raw)) {
		const allLegacy = raw.every((entry) => looksLikeLegacyArrayEntry(entry));
		if (allLegacy) {
			return {
				version: CONTENT_TYPE_EXTENDED_VERSION,
				baseDescription: baseDescriptionFallback,
				settings: normalizeSettings(undefined),
				blocks: normalizeLegacyBlocks(raw),
			};
		}

		return {
			version: CONTENT_TYPE_EXTENDED_VERSION,
			baseDescription: baseDescriptionFallback,
			settings: normalizeSettings(undefined),
			blocks: raw.map((block, idx) => normalizeBlock(block, idx)),
		};
	}

	return createDefaultContentTypeExtended(baseDescriptionFallback);
}

export function parseEscapes(raw: string): string {
	let out = '';
	for (let i = 0; i < raw.length; i += 1) {
		const ch = raw[i];
		if (ch !== '\\') {
			out += ch;
			continue;
		}
		const next = raw[i + 1];
		if (!next) {
			out += '\\';
			continue;
		}
		i += 1;
		if (next === 'n') out += '\n';
		else if (next === 'r') out += '\r';
		else if (next === 't') out += '\t';
		else if (next === '\\') out += '\\';
		else out += next;
	}
	return out;
}

export function collectEnabledAdditionalTexts(state: UserPersonContentTypeExtendedV2): string[] {
	const out: string[] = [];
	for (const block of state.blocks) {
		if (block.type === 'item') {
			if (!block.enabled) continue;
			if (block.text.trim().length === 0) continue;
			out.push(block.text);
			continue;
		}

		if (!block.enabled) continue;
		for (const item of block.items) {
			if (!item.enabled) continue;
			if (item.text.trim().length === 0) continue;
			out.push(item.text);
		}
	}
	return out;
}

export function buildFinalDescription(state: UserPersonContentTypeExtendedV2): {
	finalDescription: string;
	normalized: UserPersonContentTypeExtendedV2;
	enabledTexts: string[];
} {
	const normalized = normalizeContentTypeExtended({
		contentTypeExtended: state,
		contentTypeDefault: state.baseDescription,
	});
	const enabledTexts = collectEnabledAdditionalTexts(normalized);
	const joiner = parseEscapes(normalized.settings.additionalJoiner);
	const additionsText = enabledTexts.join(joiner);
	const baseRaw = normalized.baseDescription;
	const baseHasContent = baseRaw.trim().length > 0;
	const merged = baseHasContent ? (additionsText ? `${baseRaw}${joiner}${additionsText}` : baseRaw) : additionsText;

	const wrapped =
		normalized.settings.wrapperEnabled && merged.trim().length > 0
			? (() => {
					const tpl = normalized.settings.wrapperTemplate;
					if (tpl.length === 0) return merged;
					if (tpl.includes(WRAPPER_PLACEHOLDER)) {
						return tpl.split(WRAPPER_PLACEHOLDER).join(merged);
					}
					return `${tpl}${merged}`;
				})()
			: merged;

	return {
		finalDescription: wrapped,
		normalized,
		enabledTexts,
	};
}

export function createAdditionalItem(title: string): UserPersonContentTypeExtendedV2Item {
	return {
		type: 'item',
		id: makeId('pme_item'),
		title,
		text: '',
		enabled: true,
		collapsed: false,
	};
}

export function createAdditionalGroup(title: string): UserPersonContentTypeExtendedV2Group {
	return {
		type: 'group',
		id: makeId('pme_group'),
		title,
		enabled: true,
		collapsed: false,
		items: [],
	};
}

