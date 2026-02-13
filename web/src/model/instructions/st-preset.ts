import type {
	InstructionMeta,
	StAdvancedConfig,
	StAdvancedResponseConfig,
	StPrompt,
	StPromptOrder,
	TsInstructionMetaV1,
} from '@shared/types/instructions';

const PROMPT_ORDER_PREFERRED_CHARACTER_ID = 100001;

const ST_PRESET_DETECT_KEYS = new Set([
	'chat_completion_source',
	'prompts',
	'prompt_order',
	'openai_max_tokens',
	'openai_model',
	'temperature',
]);

export const ST_SENSITIVE_FIELDS = [
	'reverse_proxy',
	'proxy_password',
	'custom_url',
	'custom_include_body',
	'custom_exclude_body',
	'custom_include_headers',
	'vertexai_region',
	'vertexai_express_project_id',
	'azure_base_url',
	'azure_deployment_name',
] as const;

type SensitiveImportMode = 'remove' | 'keep';

type StResponseConfigKey = keyof StAdvancedResponseConfig;
type StResponseNumericKey =
	| 'temperature'
	| 'top_p'
	| 'top_k'
	| 'top_a'
	| 'min_p'
	| 'repetition_penalty'
	| 'frequency_penalty'
	| 'presence_penalty'
	| 'openai_max_tokens'
	| 'seed'
	| 'n';

const ST_RESPONSE_CONFIG_KEYS: StResponseConfigKey[] = [
	'temperature',
	'top_p',
	'top_k',
	'top_a',
	'min_p',
	'repetition_penalty',
	'frequency_penalty',
	'presence_penalty',
	'openai_max_tokens',
	'seed',
	'n',
	'reasoning_effort',
	'verbosity',
	'enable_web_search',
	'stream_openai',
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
	return value;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function normalizeStPromptRole(value: unknown): StPrompt['role'] | undefined {
	if (value === 'system' || value === 'user' || value === 'assistant') {
		return value;
	}
	return undefined;
}

function normalizePrompt(value: unknown): StPrompt | null {
	if (!isRecord(value)) return null;
	const identifier = asString(value.identifier);
	if (!identifier) return null;

	const prompt: StPrompt = { identifier };
	const name = asString(value.name);
	if (name) prompt.name = name;
	const role = normalizeStPromptRole(value.role);
	if (role) prompt.role = role;
	if (typeof value.content === 'string') prompt.content = value.content;
	if (typeof value.system_prompt === 'boolean') {
		prompt.system_prompt = value.system_prompt;
	}
	return prompt;
}

function normalizePromptOrderEntry(
	value: unknown
): { identifier: string; enabled: boolean } | null {
	if (!isRecord(value)) return null;
	const identifier = asString(value.identifier);
	if (!identifier) return null;
	return {
		identifier,
		enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
	};
}

function normalizePromptOrderItem(value: unknown): StPromptOrder | null {
	if (!isRecord(value)) return null;
	const rawCharacterId = value.character_id;
	const characterId =
		typeof rawCharacterId === 'number' && Number.isFinite(rawCharacterId)
			? Math.floor(rawCharacterId)
			: null;
	if (characterId === null) return null;

	const rawOrder = Array.isArray(value.order) ? value.order : [];
	const order = rawOrder
		.map(normalizePromptOrderEntry)
		.filter((entry): entry is { identifier: string; enabled: boolean } => Boolean(entry));

	return {
		character_id: characterId,
		order,
	};
}

function normalizeResponseConfig(
	preset: Record<string, unknown>
): StAdvancedResponseConfig {
	const responseConfig: StAdvancedResponseConfig = {};
	const numericKeys: StResponseNumericKey[] = [
		'temperature',
		'top_p',
		'top_k',
		'top_a',
		'min_p',
		'repetition_penalty',
		'frequency_penalty',
		'presence_penalty',
		'openai_max_tokens',
		'seed',
		'n',
	];

	for (const key of numericKeys) {
		const value = toFiniteNumber(preset[key]);
		if (typeof value === 'number') {
			responseConfig[key] = value;
		}
	}

	if (typeof preset.reasoning_effort === 'string') {
		responseConfig.reasoning_effort = preset.reasoning_effort;
	}
	if (typeof preset.verbosity === 'string') {
		responseConfig.verbosity = preset.verbosity;
	}
	const enableWebSearch = toOptionalBoolean(preset.enable_web_search);
	if (typeof enableWebSearch === 'boolean') {
		responseConfig.enable_web_search = enableWebSearch;
	}
	const stream = toOptionalBoolean(preset.stream_openai);
	if (typeof stream === 'boolean') {
		responseConfig.stream_openai = stream;
	}
	return responseConfig;
}

function normalizeMeta(meta: unknown): InstructionMeta {
	if (!isRecord(meta)) return {};
	return { ...meta };
}

export function getTsInstructionMeta(meta: unknown): TsInstructionMetaV1 | null {
	if (!isRecord(meta) || !isRecord(meta.tsInstruction)) return null;
	const tsInstruction = meta.tsInstruction;
	if (tsInstruction.version !== 1) return null;
	if (tsInstruction.mode !== 'basic' && tsInstruction.mode !== 'st_advanced') {
		return null;
	}
	return tsInstruction as TsInstructionMetaV1;
}

export function withTsInstructionMeta(params: {
	meta: unknown;
	tsInstruction: TsInstructionMetaV1;
}): InstructionMeta {
	const normalized = normalizeMeta(params.meta);
	return {
		...normalized,
		tsInstruction: params.tsInstruction,
	};
}

export function detectStChatCompletionPreset(
	input: unknown
): input is Record<string, unknown> {
	if (!isRecord(input)) return false;
	if (input.type === 'talespinner.instruction') return false;
	return Object.keys(input).some((key) => ST_PRESET_DETECT_KEYS.has(key));
}

export function hasSensitivePresetFields(preset: Record<string, unknown>): boolean {
	return ST_SENSITIVE_FIELDS.some((key) => Object.prototype.hasOwnProperty.call(preset, key));
}

export function stripSensitiveFieldsFromPreset(
	preset: Record<string, unknown>
): Record<string, unknown> {
	const cloned = structuredClone(preset);
	for (const key of ST_SENSITIVE_FIELDS) {
		delete cloned[key];
	}
	return cloned;
}

export function normalizeStPrompts(input: unknown): StPrompt[] {
	if (!Array.isArray(input)) return [];
	return input.map(normalizePrompt).filter((item): item is StPrompt => Boolean(item));
}

export function normalizeStPromptOrder(input: unknown): StPromptOrder[] {
	if (!Array.isArray(input)) return [];
	return input
		.map(normalizePromptOrderItem)
		.filter((item): item is StPromptOrder => Boolean(item));
}

export function createStAdvancedConfigFromPreset(params: {
	preset: Record<string, unknown>;
	fileName: string;
	sensitiveImportMode: SensitiveImportMode;
}): StAdvancedConfig {
	const rawPreset =
		params.sensitiveImportMode === 'remove'
			? stripSensitiveFieldsFromPreset(params.preset)
			: structuredClone(params.preset);
	return {
		rawPreset,
		prompts: normalizeStPrompts(rawPreset.prompts),
		promptOrder: normalizeStPromptOrder(rawPreset.prompt_order),
		responseConfig: normalizeResponseConfig(rawPreset),
		importInfo: {
			source: 'sillytavern',
			fileName: params.fileName,
			importedAt: new Date().toISOString(),
		},
	};
}

export function deriveInstructionTemplateText(stAdvanced: StAdvancedConfig): string {
	const mainPrompt = stAdvanced.prompts.find((item) => item.identifier === 'main');
	if (typeof mainPrompt?.content === 'string' && mainPrompt.content.trim().length > 0) {
		return mainPrompt.content;
	}
	return '{{char.name}}';
}

export function resolvePreferredPromptOrder(stAdvanced: StAdvancedConfig): StPromptOrder {
	const preferred =
		stAdvanced.promptOrder.find(
			(item) => item.character_id === PROMPT_ORDER_PREFERRED_CHARACTER_ID
		) ?? stAdvanced.promptOrder[0];

	if (preferred) {
		return {
			character_id: preferred.character_id,
			order: preferred.order.map((item) => ({ ...item })),
		};
	}

	return {
		character_id: PROMPT_ORDER_PREFERRED_CHARACTER_ID,
		order: stAdvanced.prompts.map((item) => ({
			identifier: item.identifier,
			enabled: true,
		})),
	};
}

export function buildStPresetFromAdvanced(stAdvanced: StAdvancedConfig): Record<string, unknown> {
	const preset = structuredClone(stAdvanced.rawPreset ?? {});
	preset.prompts = stAdvanced.prompts.map((item) => ({ ...item }));
	preset.prompt_order = stAdvanced.promptOrder.map((item) => ({
		character_id: item.character_id,
		order: item.order.map((orderItem) => ({ ...orderItem })),
	}));

	for (const key of ST_RESPONSE_CONFIG_KEYS) {
		const value = stAdvanced.responseConfig[key];
		if (typeof value === 'undefined') {
			delete preset[key];
			continue;
		}
		preset[key] = value;
	}

	return preset;
}
