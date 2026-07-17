import {
	buildOperationArtifactId,
	makeDefaultOperationArtifactConfig,
	normalizeOperationArtifactConfig,
	type LlmOperationRetryOn,
	type OperationArtifactConfig,
	type OperationInProfile,
	type OperationKind,
	type OperationRunCondition,
	type OperationTemplateParams,
} from '@shared/types/operation-profiles';
import { v4 as uuidv4 } from 'uuid';

import {
	normalizeGuardKindParams,
	serializeGuardKindParams,
	type FormGuardKindParams,
} from './guard-kind-form';
import {
	normalizeKnowledgeKindParams,
	serializeKnowledgeKindParams,
	type FormKnowledgeKindParams,
} from './knowledge-kind-form';
import {
	normalizeRetryOn,
	pickNumericSamplers,
	type OperationLlmRuntimeFields,
	type OperationSamplerFields,
} from './operation-llm-form-utils';

import type { OperationProfileDto } from '../../../../api/chat-core';

export type FormTemplateParams = Omit<OperationTemplateParams, 'strictVariables'> & {
	strictVariables: boolean;
};

export type FormOtherKindParams = {
	paramsJson: string;
	artifact: OperationArtifactConfig;
};

export type FormRunCondition = OperationRunCondition;

export type FormLlmKindParams = OperationLlmRuntimeFields &
	OperationSamplerFields & {
	system: string;
	prompt: string;
	strictVariables: boolean;
	outputMode: 'text' | 'json';
	jsonParseMode: 'raw' | 'markdown_code_block' | 'custom_regex';
	jsonCustomPattern: string;
	jsonCustomFlags: string;
	jsonSchemaText: string;
	strictSchemaValidation: boolean;
	timeoutMs: number;
	retry: {
		maxAttempts: number;
		backoffMs: number;
		retryOn: LlmOperationRetryOn[];
	};
	artifact: OperationArtifactConfig;
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
		activation: {
			everyNTurns: number;
			everyNContextTokens: number;
		};
		order: number;
		dependsOn: string[];
		runConditions: FormRunCondition[];
		params:
			| FormTemplateParams
			| FormLlmKindParams
			| FormGuardKindParams
			| FormKnowledgeKindParams
			| FormOtherKindParams;
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

function makeDefaultArtifactTag(opId: string): string {
	const suffix = opId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) || uuidv4().replace(/-/g, '').slice(0, 10);
	return `art_${suffix}`;
}

export function makeDefaultArtifactOutput(opId = uuidv4(), kind: OperationKind = 'template'): OperationArtifactConfig {
	const artifact = makeDefaultOperationArtifactConfig({
		opId,
		kind,
		title: 'Artifact',
	});
	return {
		...artifact,
		tag: makeDefaultArtifactTag(opId),
	};
}

export function makeDefaultLlmKindParams(
	opId: string,
	artifact: OperationArtifactConfig = makeDefaultArtifactOutput(opId, 'llm'),
): FormLlmKindParams {
	return {
		providerId: 'openrouter',
		credentialRef: '',
		model: '',
		llmPresetId: '',
		system: '',
		prompt: '',
		strictVariables: false,
		outputMode: 'text',
		jsonParseMode: 'raw',
		jsonCustomPattern: '',
		jsonCustomFlags: '',
		jsonSchemaText: '',
		strictSchemaValidation: false,
		samplersEnabled: false,
		samplerPresetId: '',
		samplers: {},
		timeoutMs: 60000,
		retry: {
			maxAttempts: 1,
			backoffMs: 0,
			retryOn: ['timeout', 'provider_error', 'rate_limit'],
		},
		artifact,
	};
}

export function makeDefaultOtherKindParams(
	opId: string,
	kind: Exclude<OperationKind, 'template' | 'llm' | 'guard' | 'knowledge_search' | 'knowledge_reveal'>,
	artifact: OperationArtifactConfig = makeDefaultArtifactOutput(opId, kind),
): FormOtherKindParams {
	return {
		paramsJson: '{\n  \n}',
		artifact,
	};
}

function toNonNegativeInteger(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Math.max(0, Math.floor(value));
	}
	if (typeof value === 'string') {
		const normalized = value.trim().replace(',', '.');
		if (normalized.length === 0) return 0;
		const parsed = Number(normalized);
		if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
	}
	return 0;
}

function normalizeRunConditions(value: unknown): FormRunCondition[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is FormRunCondition =>
			Boolean(item) &&
			typeof item === 'object' &&
			(item as Record<string, unknown>).type === 'guard_output' &&
			typeof (item as Record<string, unknown>).sourceOpId === 'string' &&
			typeof (item as Record<string, unknown>).outputKey === 'string' &&
			((item as Record<string, unknown>).operator === 'is_true' ||
				(item as Record<string, unknown>).operator === 'is_false'),
	);
}

function normalizeActivation(value: unknown): { everyNTurns: number; everyNContextTokens: number } {
	if (!value || typeof value !== 'object') {
		return { everyNTurns: 0, everyNContextTokens: 0 };
	}
	const raw = value as Record<string, unknown>;
	const normalize = (input: unknown): number => {
		const parsed = toNonNegativeInteger(input);
		return parsed >= 1 ? parsed : 0;
	};
	return {
		everyNTurns: normalize(raw.everyNTurns),
		everyNContextTokens: normalize(raw.everyNContextTokens),
	};
}

function normalizeTemplateParams(op: OperationInProfile): FormTemplateParams {
	const params = op.config.params as Record<string, unknown>;
	return {
		template: typeof params.template === 'string' ? params.template : '',
		strictVariables: Boolean(params.strictVariables),
		artifact: normalizeOperationArtifactConfig({
			opId: op.opId,
			kind: op.kind,
			title: op.name,
			rawParams: params,
		}),
	};
}

function normalizeOtherKindParams(op: OperationInProfile): FormOtherKindParams {
	const params = op.config.params as Record<string, unknown>;
	const rawParams =
		params.params && typeof params.params === 'object' && !Array.isArray(params.params)
			? (params.params as Record<string, unknown>)
			: {};
	return {
		paramsJson: JSON.stringify(rawParams, null, 2),
		artifact: normalizeOperationArtifactConfig({
			opId: op.opId,
			kind: op.kind,
			title: op.name,
			rawParams: params,
		}),
	};
}

function normalizeLlmKindParams(op: Extract<OperationInProfile, { kind: 'llm' }>): FormLlmKindParams {
	const raw = op.config.params as Record<string, unknown>;
	const llmParamsRaw = raw.params && typeof raw.params === 'object' ? (raw.params as Record<string, unknown>) : {};
	const providerId = llmParamsRaw.providerId === 'openai_compatible' ? 'openai_compatible' : 'openrouter';
	const outputMode = llmParamsRaw.outputMode === 'json' ? 'json' : 'text';
	const jsonParseMode =
		llmParamsRaw.jsonParseMode === 'markdown_code_block' || llmParamsRaw.jsonParseMode === 'custom_regex'
			? llmParamsRaw.jsonParseMode
			: 'raw';
	const retryRaw = llmParamsRaw.retry && typeof llmParamsRaw.retry === 'object' ? (llmParamsRaw.retry as Record<string, unknown>) : {};

	return {
		...makeDefaultLlmKindParams(
			op.opId,
			normalizeOperationArtifactConfig({
				opId: op.opId,
				kind: op.kind,
				title: op.name,
				rawParams: raw,
			}),
		),
		providerId,
		credentialRef: typeof llmParamsRaw.credentialRef === 'string' ? llmParamsRaw.credentialRef : '',
		model: typeof llmParamsRaw.model === 'string' ? llmParamsRaw.model : '',
		llmPresetId: typeof llmParamsRaw.llmPresetId === 'string' ? llmParamsRaw.llmPresetId : '',
		system: typeof llmParamsRaw.system === 'string' ? llmParamsRaw.system : '',
		prompt: typeof llmParamsRaw.prompt === 'string' ? llmParamsRaw.prompt : '',
		strictVariables: llmParamsRaw.strictVariables === true,
		outputMode,
		jsonParseMode,
		jsonCustomPattern: typeof llmParamsRaw.jsonCustomPattern === 'string' ? llmParamsRaw.jsonCustomPattern : '',
		jsonCustomFlags: typeof llmParamsRaw.jsonCustomFlags === 'string' ? llmParamsRaw.jsonCustomFlags : '',
		jsonSchemaText:
			typeof llmParamsRaw.jsonSchema === 'undefined' ? '' : JSON.stringify(llmParamsRaw.jsonSchema, null, 2),
		strictSchemaValidation: llmParamsRaw.strictSchemaValidation === true,
		samplersEnabled:
			typeof llmParamsRaw.samplerPresetId === 'string' && llmParamsRaw.samplerPresetId.length > 0
				? true
				: Object.keys(pickNumericSamplers(llmParamsRaw.samplers)).length > 0,
		samplerPresetId: typeof llmParamsRaw.samplerPresetId === 'string' ? llmParamsRaw.samplerPresetId : '',
		samplers: pickNumericSamplers(llmParamsRaw.samplers),
		timeoutMs:
			typeof llmParamsRaw.timeoutMs === 'number' && Number.isFinite(llmParamsRaw.timeoutMs)
				? llmParamsRaw.timeoutMs
				: 60000,
		retry: {
			maxAttempts:
				typeof retryRaw.maxAttempts === 'number' && Number.isFinite(retryRaw.maxAttempts)
					? Math.max(1, Math.floor(retryRaw.maxAttempts))
					: 1,
			backoffMs:
				typeof retryRaw.backoffMs === 'number' && Number.isFinite(retryRaw.backoffMs)
					? Math.max(0, Math.floor(retryRaw.backoffMs))
					: 0,
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
				activation: normalizeActivation((op.config as any).activation),
				dependsOn: op.config.dependsOn ?? [],
				runConditions: normalizeRunConditions((op.config as Record<string, unknown>).runConditions),
				enabled: Boolean(op.config.enabled),
				required: Boolean(op.config.required),
				order: Number((op.config as any).order ?? 0),
				params:
					op.kind === 'template'
						? normalizeTemplateParams(op)
						: op.kind === 'guard'
							? normalizeGuardKindParams(op)
						: op.kind === 'llm'
							? normalizeLlmKindParams(op)
							: op.kind === 'knowledge_search' || op.kind === 'knowledge_reveal'
								? normalizeKnowledgeKindParams(op)
							: normalizeOtherKindParams(op),
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
			const everyNTurns = toNonNegativeInteger(op.config.activation?.everyNTurns);
			const everyNContextTokens = toNonNegativeInteger(op.config.activation?.everyNContextTokens);
			const activation =
				everyNTurns > 0 || everyNContextTokens > 0
					? {
							everyNTurns: everyNTurns > 0 ? everyNTurns : undefined,
							everyNContextTokens: everyNContextTokens > 0 ? everyNContextTokens : undefined,
						}
					: undefined;
			const runConditions = op.config.runConditions?.length ? normalizeRunConditions(op.config.runConditions) : undefined;
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
						activation,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						runConditions,
						params: {
							template: params.template,
							strictVariables: params.strictVariables ? true : undefined,
							artifact: {
								...params.artifact,
								artifactId: params.artifact.artifactId || buildOperationArtifactId(op.opId),
							},
						},
					},
				};
			}

			if (op.kind === 'guard') {
				const params = op.config.params as FormGuardKindParams;
				return {
					opId: op.opId,
					name: op.name,
					description: op.description.trim() ? op.description.trim() : undefined,
					kind: 'guard',
					config: {
						enabled: Boolean(op.config.enabled),
						required: Boolean(op.config.required),
						hooks: op.config.hooks,
						triggers: op.config.triggers,
						activation,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						runConditions,
						params: serializeGuardKindParams(params, op.opId),
					},
				};
			}

			if (op.kind === 'knowledge_search' || op.kind === 'knowledge_reveal') {
				const params = op.config.params as FormKnowledgeKindParams;
				return {
					opId: op.opId,
					name: op.name,
					description: op.description.trim() ? op.description.trim() : undefined,
					kind: op.kind,
					config: {
						enabled: Boolean(op.config.enabled),
						required: Boolean(op.config.required),
						hooks: op.config.hooks,
						triggers: op.config.triggers,
						activation,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						runConditions,
						params: serializeKnowledgeKindParams(params, op.opId),
					},
				} as OperationInProfile;
			}

			if (op.kind === 'llm') {
				const params = op.config.params as FormLlmKindParams;
				const model = params.model.trim();
				const llmPresetId = params.llmPresetId.trim();
				const system = params.system.trim();
				const samplerPresetId = params.samplerPresetId.trim();
				const jsonCustomPattern = params.jsonCustomPattern.trim();
				const jsonCustomFlags = params.jsonCustomFlags.trim();
				const jsonSchemaText = params.jsonSchemaText.trim();
				const timeoutMs = Number.isFinite(params.timeoutMs) ? Math.max(1, Math.floor(params.timeoutMs)) : undefined;
				const retryMaxAttempts = Number.isFinite(params.retry.maxAttempts) ? Math.max(1, Math.floor(params.retry.maxAttempts)) : 1;
				const retryBackoffMs = Number.isFinite(params.retry.backoffMs) ? Math.max(0, Math.floor(params.retry.backoffMs)) : 0;
				const retryOn = normalizeRetryOn(params.retry.retryOn);
				const samplers = params.samplersEnabled ? pickNumericSamplers(params.samplers) : {};
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
						activation,
						order: Number(op.config.order),
						dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
						runConditions,
						params: {
							params: {
								providerId: params.providerId,
								credentialRef: params.credentialRef.trim(),
								model: model.length > 0 ? model : undefined,
								llmPresetId: llmPresetId.length > 0 ? llmPresetId : undefined,
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
								samplerPresetId:
									params.samplersEnabled && samplerPresetId.length > 0 ? samplerPresetId : undefined,
								samplers: params.samplersEnabled && hasSamplers ? samplers : undefined,
								timeoutMs,
								retry: {
									maxAttempts: retryMaxAttempts,
									backoffMs: retryBackoffMs,
									retryOn,
								},
							},
							artifact: {
								...params.artifact,
								artifactId: params.artifact.artifactId || buildOperationArtifactId(op.opId),
							},
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
				} catch (error) {
					if (options?.validateJson) throw error;
					parsed = {};
				}
			}
			const asObj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

			return {
				opId: op.opId,
				name: op.name,
				description: op.description.trim() ? op.description.trim() : undefined,
				kind: op.kind as Exclude<
					OperationKind,
					'template' | 'llm' | 'guard' | 'knowledge_search' | 'knowledge_reveal'
				>,
				config: {
					enabled: Boolean(op.config.enabled),
					required: Boolean(op.config.required),
					hooks: op.config.hooks,
					triggers: op.config.triggers,
					activation,
					order: Number(op.config.order),
					dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
					runConditions,
					params: {
						params: asObj,
						artifact: {
							...params.artifact,
							artifactId: params.artifact.artifactId || buildOperationArtifactId(op.opId),
						},
					},
				},
			} as OperationInProfile;
		}),
	};
}

export function makeDefaultOperation(): FormOperation {
	const opId = uuidv4();
	return {
		opId,
		name: 'New operation',
		description: '',
		kind: 'template',
			config: {
				enabled: true,
				required: false,
				hooks: ['before_main_llm'],
				triggers: ['generate', 'regenerate'],
				activation: {
					everyNTurns: 0,
					everyNContextTokens: 0,
				},
				order: 10,
				dependsOn: [],
				runConditions: [],
				params: {
					template: '',
					strictVariables: false,
					artifact: makeDefaultArtifactOutput(opId, 'template'),
				},
		},
	};
}
