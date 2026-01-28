import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../../api/chat-core';
import type { OperationInProfile, OperationKind, OperationOutput, OperationTemplateParams } from '@shared/types/operation-profiles';

export type FormTemplateParams = OperationTemplateParams & {
	strictVariables: boolean;
};

export type FormOtherKindParams = {
	paramsJson: string;
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
		params: FormTemplateParams | FormOtherKindParams;
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
	if (!params || typeof params !== 'object') {
		return { paramsJson: '{\n  \n}', output: defaultOutput };
	}

	const p = params as any;
	const output: OperationOutput = p.output && typeof p.output === 'object' ? (p.output as OperationOutput) : defaultOutput;
	const rawParams = p.params && typeof p.params === 'object' && !Array.isArray(p.params) ? (p.params as Record<string, unknown>) : {};
	return { paramsJson: JSON.stringify(rawParams, null, 2), output };
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
				kind: op.kind as Exclude<OperationKind, 'template'>,
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

