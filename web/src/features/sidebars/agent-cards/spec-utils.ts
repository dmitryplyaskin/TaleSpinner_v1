type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return '';
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => asString(item))
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function asObjectOrNull(value: unknown): JsonRecord | null {
	return isRecord(value) ? value : null;
}

function pickString(root: JsonRecord, data: JsonRecord | null, key: string): string {
	const top = asString(root[key]);
	if (top.length > 0) return top;
	if (!data) return '';
	return asString(data[key]);
}

function pickStringArray(root: JsonRecord, data: JsonRecord | null, key: string): string[] {
	const top = asStringArray(root[key]);
	if (top.length > 0) return top;
	if (!data) return [];
	return asStringArray(data[key]);
}

export type ParsedSpec = {
	name: string;
	description: string;
	personality: string;
	scenario: string;
	firstMes: string;
	mesExample: string;
	systemPrompt: string;
	postHistoryInstructions: string;
	creatorNotes: string;
	creator: string;
	characterVersion: string;
	tags: string[];
	alternateGreetings: string[];
	extensions: unknown;
	characterBook: unknown;
	sourceSpecVersion: string | null;
};

export function parseSpec(spec: unknown): ParsedSpec {
	const root = isRecord(spec) ? spec : {};
	const data = asObjectOrNull(root.data);
	const source = asObjectOrNull(root.source);
	const sourceSpecVersion =
		asString(source?.spec_version).trim() ||
		asString(root.spec_version).trim() ||
		asString(data?.spec_version).trim() ||
		null;

	return {
		name: pickString(root, data, 'name'),
		description: pickString(root, data, 'description'),
		personality: pickString(root, data, 'personality'),
		scenario: pickString(root, data, 'scenario'),
		firstMes: pickString(root, data, 'first_mes'),
		mesExample: pickString(root, data, 'mes_example'),
		systemPrompt: pickString(root, data, 'system_prompt'),
		postHistoryInstructions: pickString(root, data, 'post_history_instructions'),
		creatorNotes: pickString(root, data, 'creator_notes'),
		creator: pickString(root, data, 'creator'),
		characterVersion: pickString(root, data, 'character_version'),
		tags: pickStringArray(root, data, 'tags'),
		alternateGreetings: pickStringArray(root, data, 'alternate_greetings'),
		extensions: typeof root.extensions !== 'undefined' ? root.extensions : data?.extensions,
		characterBook: typeof root.character_book !== 'undefined' ? root.character_book : data?.character_book,
		sourceSpecVersion,
	};
}

export function estimateTokens(spec: ParsedSpec): number {
	const textParts = [
		spec.name,
		spec.description,
		spec.firstMes,
	];
	const totalChars = textParts.reduce((sum, item) => sum + item.length, 0);
	return Math.round(totalChars / 4);
}

export function getSpecSummary(spec: ParsedSpec): string {
	if (spec.description.length > 0) return spec.description;
	if (spec.personality.length > 0) return spec.personality;
	if (spec.scenario.length > 0) return spec.scenario;
	return '';
}

export function getSpecSearchText(spec: ParsedSpec): string {
	return [spec.name, spec.description, spec.personality, spec.scenario, ...spec.tags].join(' ').toLowerCase();
}
