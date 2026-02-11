import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../../api/chat-core';
import type {
	LlmOperationParams,
	LlmOperationRetryOn,
	LlmOperationSamplers,
	OperationInProfile,
	OperationKind,
	OperationOutput,
	OperationTemplateParams,
} from '@shared/types/operation-profiles';

export type FormTemplateParams = OperationTemplateParams & {
	strictVariables: boolean;
};

export type FormOtherKindParams = {
	paramsJson: string;
	output: OperationOutput;
};

export type FormLlmKindParams = {
	providerId: LlmOperationParams['providerId'];
	credentialRef: string;
	model: string;
	system: string;
	prompt: string;
	strictVariables: boolean;
	outputMode: 'text' | 'json';
	jsonParseMode: 'raw' | 'markdown_code_block' | 'custom_regex';
	jsonCustomPattern: string;
	jsonCustomFlags: string;
	jsonSchemaText: string;
	strictSchemaValidation: boolean;
	samplerPresetId: string;
	samplers: LlmOperationSamplers;
	timeoutMs: number;
	retry: {
		maxAttempts: number;
		backoffMs: number;
		retryOn: LlmOperationRetryOn[];
	};
	output: OperationOutput;
};

export type FormOperation = {
	opId: string;
	name: string;
	description: string;
	kind: OperationKind;
	config: {
		enabled: boolean;
		required: boolean;
		hooks: Array<'before_main_llm' | 'after_main_llm'>;
		triggers: Array<'generate' | 'regenerate'>;
		order: number;
		dependsOn: string[];
		params: FormTemplateParams | FormLlmKindParams | FormOtherKindParams;
	};
};

export type OperationProfileFormValues = {
	name: string;
	description: string;
	enabled: boolean;
	executionMode: 'concurrent' | 'sequential';
	operationProfileSessionId: string;
	operations: FormOperation[];
};

export function makeDefaultArtifactOutput(): Extract<OperationOutput, { type: 'artifacts' }> {
	return {
		type: 'artifacts',
		writeArtifact: {
			tag: `artifact_${Math.random().toString(16).slice(2, 8)}`,
			persistence: 'run_only',
			usage: 'internal',
			semantics: 'intermediate',
		},
	};
}

export function makeDefaultLlmKindParams(
	output: OperationOutput = makeDefaultArtifactOutput(),
): FormLlmKindParams {
	return {
		providerId: 'openrouter',
		credentialRef: '',
		model: '',
		system: '',
		prompt: '',
		strictVariables: false,
		outputMode: 'text',
		jsonParseMode: 'raw',
		jsonCustomPattern: '',
		jsonCustomFlags: '',
		jsonSchemaText: '',
		strictSchemaValidation: false,
		samplerPresetId: '',
		samplers: {},
		timeoutMs: 60000,
		retry: {
			maxAttempts: 1,
			backoffMs: 0,
			retryOn: ['timeout', 'provider_error', 'rate_limit'],
		},
		output,
	};
}

export function makeDefaultOtherKindParams(
	output: OperationOutput = makeDefaultArtifactOutput(),
): FormOtherKindParams {
	return {
		paramsJson: '{\n  \n}',
		output,
	};
}

function normalizeTemplateParams(params: unknown): OperationTemplateParams {
	if (!params || typeof params !== 'object') {
		return {
			template: '',
			strictVariables: false,
			output: {
				type: 'artifacts',
				writeArtifact: makeDefaultArtifactOutput().writeArtifact,
			},
		};
	}

	const p = params as any;
	if (p.output && typeof p.output === 'object') return p as OperationTemplateParams;

	// Legacy compatibility: params.writeArtifact -> params.output.type="artifacts"
	if (p.writeArtifact && typeof p.writeArtifact === 'object') {
		return {
			template: typeof p.template === 'string' ? p.template : '',
			strictVariables: Boolean(p.strictVariables),
			output: {
				type: 'artifacts',
				writeArtifact: p.writeArtifact,
			},
		};
	}

	return {
		template: typeof p.template === 'string' ? p.template : '',
		strictVariables: Boolean(p.strictVariables),
		output: {
			type: 'artifacts',
			writeArtifact: {
				tag: `artifact_${Math.random().toString(16).slice(2, 8)}`,
				persistence: 'run_only',
				usage: 'internal',
				semantics: 'intermediate',
			},
		},
	};
}

function normalizeOtherKindParams(params: unknown): FormOtherKindParams {
	const defaultOutput = makeDefaultArtifactOutput();
	if (!params || typeof params !== 'object') return makeDefaultOtherKindParams(defaultOutput);

	const p = params as any;
	const output: OperationOutput = p.output && typeof p.output === 'object' ? (p.output as OperationOutput) : defaultOutput;
	const rawParams = p.params && typeof p.params === 'object' && !Array.isArray(p.params) ? (p.params as Record<string, unknown>) : {};
	return { paramsJson: JSON.stringify(rawParams, null, 2), output };
}

function pickNumericSamplers(raw: unknown): LlmOperationSamplers {
	if (!raw || typeof raw !== 'object') return {};
	const r = raw as Record<string, unknown>;
	const out: LlmOperationSamplers = {};
	if (typeof r.temperature === 'number' && Number.isFinite(r.temperature)) out.temperature = r.temperature;
	if (typeof r.topP === 'number' && Number.isFinite(r.topP)) out.topP = r.topP;
	if (typeof r.topK === 'number' && Number.isFinite(r.topK)) out.topK = r.topK;
	if (typeof r.frequencyPenalty === 'number' && Number.isFinite(r.frequencyPenalty)) out.frequencyPenalty = r.frequencyPenalty;
	if (typeof r.presencePenalty === 'number' && Number.isFinite(r.presencePenalty)) out.presencePenalty = r.presencePenalty;
	if (typeof r.seed === 'number' && Number.isFinite(r.seed)) out.seed = r.seed;
	if (typeof r.maxTokens === 'number' && Number.isFinite(r.maxTokens)) out.maxTokens = r.maxTokens;
	return out;
}

function normalizeRetryOn(value: unknown): LlmOperationRetryOn[] {
	if (!Array.isArray(value)) return ['timeout', 'provider_error', 'rate_limit'];
	const filtered = value.filter(
		(item): item is LlmOperationRetryOn => item === 'timeout' || item === 'provider_error' || item === 'rate_limit',
	);
	const unique = Array.from(new Set(filtered));
	return unique.length > 0 ? unique : ['timeout', 'provider_error', 'rate_limit'];
}

function normalizeLlmKindParams(params: unknown): FormLlmKindParams {
	if (!params || typeof params !== 'object') return makeDefaultLlmKindParams();

	const raw = params as any;
	const llmParamsRaw = raw.params && typeof raw.params === 'object' ? raw.params : {};
	const output: OperationOutput =
		raw.output && typeof raw.output === 'object' ? (raw.output as OperationOutput) : makeDefaultArtifactOutput();

	const base = makeDefaultLlmKindParams(output);
	const providerId = llmParamsRaw.providerId === 'openai_compatible' ? 'openai_compatible' : 'openrouter';
	const outputMode = llmParamsRaw.outputMode === 'json' ? 'json' : 'text';
	const jsonParseMode =
		llmParamsRaw.jsonParseMode === 'markdown_code_block' || llmParamsRaw.jsonParseMode === 'custom_regex'
			? llmParamsRaw.jsonParseMode
			: 'raw';
	const retryRaw = llmParamsRaw.retry && typeof llmParamsRaw.retry === 'object' ? llmParamsRaw.retry : {};

	return {
		...base,
		output,
		providerId,
		credentialRef: typeof llmParamsRaw.credentialRef === 'string' ? llmParamsRaw.credentialRef : '',
		model: typeof llmParamsRaw.model === 'string' ? llmParamsRaw.model : '',
		system: typeof llmParamsRaw.system === 'string' ? llmParamsRaw.system : '',
		prompt: typeof llmParamsRaw.prompt === 'string' ? llmParamsRaw.prompt : '',
		strictVariables: llmParamsRaw.strictVariables === true,
		outputMode,
		jsonParseMode,
		jsonCustomPattern: typeof llmParamsRaw.jsonCustomPattern === 'string' ? llmParamsRaw.jsonCustomPattern : '',
		jsonCustomFlags: typeof llmParamsRaw.jsonCustomFlags === 'string' ? llmParamsRaw.jsonCustomFlags : '',
		jsonSchemaText:
			typeof llmParamsRaw.jsonSchema === 'undefined'
				? ''
				: JSON.stringify(llmParamsRaw.jsonSchema, null, 2),
		strictSchemaValidation: llmParamsRaw.strictSchemaValidation === true,
		samplerPresetId: typeof llmParamsRaw.samplerPresetId === 'string' ? llmParamsRaw.samplerPresetId : '',
		samplers: pickNumericSamplers(llmParamsRaw.samplers),
		timeoutMs:
			typeof llmParamsRaw.timeoutMs === 'number' && Number.isFinite(llmParamsRaw.timeoutMs) ? llmParamsRaw.timeoutMs : base.timeoutMs,
		retry: {
			maxAttempts:
				typeof retryRaw.maxAttempts === 'number' && Number.isFinite(retryRaw.maxAttempts)
					? Math.max(1, Math.floor(retryRaw.maxAttempts))
					: base.retry.maxAttempts,
			backoffMs:
				typeof retryRaw.backoffMs === 'number' && Number.isFinite(retryRaw.backoffMs)
					? Math.max(0, Math.floor(retryRaw.backoffMs))
					: base.retry.backoffMs,
			retryOn: normalizeRetryOn(retryRaw.retryOn),
		},
	};
}

export function toOperationProfileForm(profile: OperationProfileDto): OperationProfileFormValues {
	return {
		name: profile.name,
		description: profile.description ?? '',
		enabled: profile.enabled,
		executionMode: profile.executionMode,
		operationProfileSessionId: profile.operationProfileSessionId,
		operations: (profile.operations ?? []).map((op): FormOperation => ({
			opId: op.opId,
			name: op.name,
			description: op.description ?? '',
			kind: op.kind,
			config: {
				hooks: (op.config.hooks?.length ? op.config.hooks : ['before_main_llm']) as any,
				triggers: (op.config.triggers?.length ? op.config.triggers : ['generate', 'regenerate']) as any,
				dependsOn: op.config.dependsOn ?? [],
				enabled: Boolean(op.config.enabled),
				required: Boolean(op.config.required),
				order: Number((op.config as any).order ?? 0),
				params:
					op.kind === 'template'
						? ({
								...normalizeTemplateParams(op.config.params as unknown),
								strictVariables: Boolean((op.config.params as any)?.strictVariables),
							} satisfies FormTemplateParams)
						: op.kind === 'llm'
							? (normalizeLlmKindParams(op.config.params as unknown) satisfies FormLlmKindParams)
						: (normalizeOtherKindParams(op.config.params as unknown) satisfies FormOtherKindParams),
			},
		})),
	};
}

export function fromOperationProfileForm(
	values: OperationProfileFormValues,
	options?: { validateJson?: boolean },
): {
	name: string;
	description?: string;
	enabled: boolean;
	executionMode: 'concurrent' | 'sequential';
	operationProfileSessionId: string;
	operations: OperationInProfile[];
} {
	return {
		name: values.name,
		description: values.description.trim() ? values.description.trim() : undefined,
		enabled: values.enabled,
		executionMode: values.executionMode,
		operationProfileSessionId: values.operationProfileSessionId,
		operations: values.operations.map((op): OperationInProfile => {
			if (op.kind === 'template') {
				const params = op.config.params as FormTemplateParams;
				return {
					opId: op.opId,
					name: op.name,
					description: op.description.trim() ? op.description.trim() : undefined,
					kind: 'template',
					config: {
						enabled: Boolean(op.config.enabled),
						required: Boolean(op.config.required),
						hooks: op.config.hooks,
						triggers: op.config.triggers,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						params: {
							template: params.template,
							strictVariables: params.strictVariables ? true : undefined,
							output: params.output,
						},
					},
				};
			}

			if (op.kind === 'llm') {
				const params = op.config.params as FormLlmKindParams;
				const model = params.model.trim();
				const system = params.system.trim();
				const samplerPresetId = params.samplerPresetId.trim();
				const jsonCustomPattern = params.jsonCustomPattern.trim();
				const jsonCustomFlags = params.jsonCustomFlags.trim();
				const jsonSchemaText = params.jsonSchemaText.trim();
				const timeoutMs = Number.isFinite(params.timeoutMs) ? Math.max(1, Math.floor(params.timeoutMs)) : undefined;
				const retryMaxAttempts = Number.isFinite(params.retry.maxAttempts)
					? Math.max(1, Math.floor(params.retry.maxAttempts))
					: 1;
				const retryBackoffMs = Number.isFinite(params.retry.backoffMs)
					? Math.max(0, Math.floor(params.retry.backoffMs))
					: 0;
				const retryOn = normalizeRetryOn(params.retry.retryOn);
				const samplers = pickNumericSamplers(params.samplers);
				const hasSamplers = Object.keys(samplers).length > 0;
				let parsedJsonSchema: unknown = undefined;
				if (jsonSchemaText.length > 0) {
					try {
						parsedJsonSchema = JSON.parse(jsonSchemaText) as unknown;
					} catch (error) {
						if (options?.validateJson) throw error;
						parsedJsonSchema = undefined;
					}
				}

				return {
					opId: op.opId,
					name: op.name,
					description: op.description.trim() ? op.description.trim() : undefined,
					kind: 'llm',
					config: {
						enabled: Boolean(op.config.enabled),
						required: Boolean(op.config.required),
						hooks: op.config.hooks,
						triggers: op.config.triggers,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						params: {
							params: {
								providerId: params.providerId,
								credentialRef: params.credentialRef.trim(),
								model: model.length > 0 ? model : undefined,
								system: system.length > 0 ? system : undefined,
								prompt: params.prompt,
								strictVariables: params.strictVariables ? true : undefined,
								outputMode: params.outputMode,
								jsonParseMode: params.outputMode === 'json' ? params.jsonParseMode : undefined,
								jsonCustomPattern:
									params.outputMode === 'json' && params.jsonParseMode === 'custom_regex' && jsonCustomPattern.length > 0
										? jsonCustomPattern
										: undefined,
								jsonCustomFlags:
									params.outputMode === 'json' && params.jsonParseMode === 'custom_regex' && jsonCustomFlags.length > 0
										? jsonCustomFlags
										: undefined,
								jsonSchema: typeof parsedJsonSchema === 'undefined' ? undefined : parsedJsonSchema,
								strictSchemaValidation: params.strictSchemaValidation ? true : undefined,
								samplerPresetId: samplerPresetId.length > 0 ? samplerPresetId : undefined,
								samplers: hasSamplers ? samplers : undefined,
								timeoutMs,
								retry: {
									maxAttempts: retryMaxAttempts,
									backoffMs: retryBackoffMs,
									retryOn,
								},
							},
							output: params.output,
						},
					},
				};
			}

			const params = op.config.params as FormOtherKindParams;
			let parsed: unknown = {};
			const raw = params.paramsJson?.trim() ?? '';
			if (raw) {
				try {
					parsed = JSON.parse(raw) as unknown;
				} catch (e) {
					if (options?.validateJson) throw e;
					parsed = {};
				}
			}
			const asObj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

			return {
				opId: op.opId,
				name: op.name,
				description: op.description.trim() ? op.description.trim() : undefined,
				kind: op.kind as Exclude<OperationKind, 'template' | 'llm'>,
				config: {
					enabled: Boolean(op.config.enabled),
					required: Boolean(op.config.required),
					hooks: op.config.hooks,
					triggers: op.config.triggers,
					order: Number(op.config.order),
					dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
					params: {
						params: asObj,
						output: params.output,
					},
				},
			};
		}),
	};
}

export function makeDefaultOperation(): FormOperation {
	return {
		opId: uuidv4(),
		name: 'New operation',
		description: '',
		kind: 'template',
		config: {
			enabled: true,
			required: false,
			hooks: ['before_main_llm'],
			triggers: ['generate', 'regenerate'],
			order: 10,
			dependsOn: [],
			params: {
				template: '',
				strictVariables: false,
				output: makeDefaultArtifactOutput(),
			},
		},
	};
}
