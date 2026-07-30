import { describe, expect, it } from 'vitest';

import { makeDefaultGuardKindParams } from './guard-kind-form';
import {
	fromOperationProfileForm,
	makeDefaultOperation,
	toOperationProfileForm,
	type OperationProfileFormValues,
} from './operation-profile-form-mapping';

import type { OperationProfileDto } from '../../../../api/chat-core';
import type { OperationArtifactConfig } from '@shared/types/operation-profiles';

function makeArtifact(overrides?: Partial<OperationArtifactConfig>) {
	return {
		artifactId: 'artifact:test',
		tag: 'test_artifact',
		title: 'Test Artifact',
		format: 'json' as const,
		persistence: 'run_only' as const,
		writeMode: 'replace' as const,
		history: {
			enabled: true,
			maxItems: 5,
		},
		exposures: [],
		...overrides,
	};
}

describe('operation profile form mapping', () => {
	it('creates new operations with unique art-prefixed artifact tags', () => {
		const first = makeDefaultOperation();
		const second = makeDefaultOperation();

		expect(first.config.params.artifact.tag).toMatch(/^art_[a-z0-9]+$/);
		expect(second.config.params.artifact.tag).toMatch(/^art_[a-z0-9]+$/);
		expect(first.config.params.artifact.tag).not.toBe(second.config.params.artifact.tag);
	});

	it('creates guard defaults with a valid output contract', () => {
		const params = makeDefaultGuardKindParams('guard-1');

		expect(params.outputContract).toEqual([
			{
				key: 'branch_1',
				title: 'Branch 1',
			},
		]);
	});

	it('normalizes guard operations and runConditions into form values', () => {
		const profile: OperationProfileDto = {
			profileId: 'profile-1',
			ownerId: 'owner-1',
			name: 'Profile',
			description: 'Profile description',
			enabled: true,
			executionMode: 'sequential',
			operationProfileSessionId: 'session-1',
			blockRefs: [],
			operations: [
				{
					opId: 'guard-1',
					name: 'Battle Guard',
					kind: 'guard',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						order: 10,
						params: {
							engine: 'liquid',
							outputContract: [{ key: 'isBattle', title: 'Battle' }],
							template: '{"isBattle": true}',
							strictVariables: true,
							artifact: makeArtifact({ artifactId: 'artifact:guard-1', tag: 'battle_guard' }),
						},
					},
				},
				{
					opId: 'template-1',
					name: 'Consumer',
					kind: 'template',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						order: 20,
						dependsOn: ['guard-1'],
						runConditions: [
							{
								type: 'guard_output',
								sourceOpId: 'guard-1',
								outputKey: 'isBattle',
								operator: 'is_true',
							},
						],
						params: {
							template: 'battle',
							artifact: makeArtifact({ artifactId: 'artifact:template-1', tag: 'battle_result', format: 'markdown' }),
						},
					},
				},
			],
			meta: {},
			version: 1,
			createdAt: '2026-03-15T00:00:00.000Z',
			updatedAt: '2026-03-15T00:00:00.000Z',
		};

		const form = toOperationProfileForm(profile);
		const guard = form.operations[0];
		const consumer = form.operations[1];

		expect(guard.kind).toBe('guard');
		expect(guard.config.params).toMatchObject({
			engine: 'liquid',
			outputContract: [{ key: 'isBattle', title: 'Battle' }],
			template: '{"isBattle": true}',
			strictVariables: true,
			artifact: expect.objectContaining({
				artifactId: 'artifact:guard-1',
				tag: 'battle_guard',
				format: 'json',
			}),
		});
		expect(consumer.config.runConditions).toEqual([
			{
				type: 'guard_output',
				sourceOpId: 'guard-1',
				outputKey: 'isBattle',
				operator: 'is_true',
			},
		]);
	});

	it('serializes guard operations with aux llm params back to dto shape', () => {
		const values: OperationProfileFormValues = {
			name: 'Profile',
			description: '',
			enabled: true,
			executionMode: 'concurrent',
			operationProfileSessionId: 'session-1',
			operations: [
				{
					opId: 'guard-1',
					name: 'Night Guard',
					description: '',
					kind: 'guard',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate', 'regenerate'],
						activation: { everyNTurns: 0, everyNContextTokens: 0 },
						order: 5,
						dependsOn: [],
						runConditions: [],
						params: {
							engine: 'aux_llm',
							outputContract: [{ key: 'isNight', title: 'Night' }],
							template: '',
							prompt: 'Classify scene',
							system: 'System',
							strictVariables: true,
							providerId: 'openrouter',
							credentialRef: 'cred-1',
							model: 'gpt-test',
							llmPresetId: 'preset-1',
							samplersEnabled: true,
							samplerPresetId: 'sampler-1',
							samplers: { temperature: 0.2 },
							timeoutMs: 15000,
							retry: {
								maxAttempts: 2,
								backoffMs: 250,
								retryOn: ['timeout'],
							},
							artifact: makeArtifact({ artifactId: 'artifact:guard-1', tag: 'night_guard', format: 'json' }),
						},
					},
				},
				{
					opId: 'template-1',
					name: 'Consumer',
					description: '',
					kind: 'template',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						activation: { everyNTurns: 0, everyNContextTokens: 0 },
						order: 10,
						dependsOn: ['guard-1'],
						runConditions: [
							{
								type: 'guard_output',
								sourceOpId: 'guard-1',
								outputKey: 'isNight',
								operator: 'is_false',
							},
						],
						params: {
							template: 'daytime',
							strictVariables: false,
							artifact: makeArtifact({ artifactId: 'artifact:template-1', tag: 'consumer_artifact', format: 'markdown' }),
						},
					},
				},
			],
		};

		const result = fromOperationProfileForm(values, { validateJson: true });
		const guard = result.operations[0];
		const consumer = result.operations[1];

		expect(guard).toMatchObject({
			kind: 'guard',
			config: {
				params: {
					engine: 'aux_llm',
					outputContract: [{ key: 'isNight', title: 'Night' }],
					prompt: 'Classify scene',
					system: 'System',
					strictVariables: true,
					providerId: 'openrouter',
					credentialRef: 'cred-1',
					model: 'gpt-test',
					samplers: { temperature: 0.2 },
					timeoutMs: 15000,
					retry: {
						maxAttempts: 2,
						backoffMs: 250,
						retryOn: ['timeout'],
					},
					artifact: expect.objectContaining({
						format: 'json',
					}),
				},
			},
		});
		expect(consumer.config.runConditions).toEqual([
			{
				type: 'guard_output',
				sourceOpId: 'guard-1',
				outputKey: 'isNight',
				operator: 'is_false',
			},
		]);
	});

	it('does not serialize sampler overrides when they are disabled', () => {
		const values: OperationProfileFormValues = {
			name: 'Profile',
			description: '',
			enabled: true,
			executionMode: 'concurrent',
			operationProfileSessionId: 'session-1',
			operations: [
				{
					opId: 'llm-1',
					name: 'LLM op',
					description: '',
					kind: 'llm',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						activation: { everyNTurns: 0, everyNContextTokens: 0 },
						order: 10,
						dependsOn: [],
						runConditions: [],
						params: {
							providerId: 'openrouter',
							credentialRef: 'cred-1',
							model: 'gpt-test',
							system: '',
							prompt: 'Prompt',
							strictVariables: false,
							outputMode: 'text',
							jsonParseMode: 'raw',
							jsonCustomPattern: '',
							jsonCustomFlags: '',
							jsonSchemaText: '',
							strictSchemaValidation: false,
							llmPresetId: 'preset-1',
							samplersEnabled: false,
							samplerPresetId: 'sampler-1',
							samplers: { temperature: 0.2 },
							timeoutMs: 60000,
							retry: {
								maxAttempts: 1,
								backoffMs: 0,
								retryOn: ['timeout'],
							},
							artifact: makeArtifact({ artifactId: 'artifact:llm-1', tag: 'llm_op', format: 'markdown' }),
						},
					},
				},
			],
		};

		const result = fromOperationProfileForm(values, { validateJson: true });
		const llm = result.operations[0];

		expect(llm).toMatchObject({
			kind: 'llm',
			config: {
				params: {
					params: {
						providerId: 'openrouter',
						credentialRef: 'cred-1',
						model: 'gpt-test',
						llmPresetId: 'preset-1',
					},
				},
			},
		});
		expect((llm as { config: { params: { params: { samplers?: unknown } } } }).config.params.params.samplers).toBeUndefined();
	});

	it('restores the selected LLM preset from a saved operation', () => {
		const profile: OperationProfileDto = {
			profileId: 'profile-llm',
			ownerId: 'owner-1',
			name: 'Profile',
			description: undefined,
			enabled: true,
			executionMode: 'sequential',
			operationProfileSessionId: 'session-llm',
			blockRefs: [],
			operations: [
				{
					opId: 'llm-1',
					name: 'LLM op',
					kind: 'llm',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						order: 10,
						params: {
							params: {
								providerId: 'openrouter',
								credentialRef: 'cred-1',
								model: 'gpt-test',
								llmPresetId: 'preset-1',
								prompt: 'Prompt',
							},
							artifact: makeArtifact({ artifactId: 'artifact:llm-1', tag: 'llm_op' }),
						},
					},
				},
			],
			meta: {},
			version: 1,
			createdAt: '2026-07-17T00:00:00.000Z',
			updatedAt: '2026-07-17T00:00:00.000Z',
		};

		const form = toOperationProfileForm(profile);

		expect(form.operations[0]?.config.params).toMatchObject({ llmPresetId: 'preset-1' });
	});

	it('normalizes knowledge operations into dedicated form params', () => {
		const profile: OperationProfileDto = {
			profileId: 'profile-knowledge',
			ownerId: 'owner-1',
			name: 'Profile',
			description: undefined,
			enabled: true,
			executionMode: 'sequential',
			operationProfileSessionId: 'session-knowledge',
			blockRefs: [],
			operations: [
				{
					opId: 'knowledge-search-1',
					name: 'Knowledge Search',
					kind: 'knowledge_search',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						order: 10,
						params: {
							params: {
								source: {
									mode: 'inline',
									requestTemplate: '{"textQuery":"forest","limit":5}',
									strictVariables: true,
								},
							},
							artifact: makeArtifact({
								artifactId: 'artifact:knowledge-search-1',
								tag: 'knowledge_search_result',
								format: 'json',
							}),
						},
					},
				},
				{
					opId: 'knowledge-reveal-1',
					name: 'Knowledge Reveal',
					kind: 'knowledge_reveal',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						order: 20,
						params: {
							params: {
								source: {
									mode: 'artifact',
									artifactTag: 'planner_result',
								},
							},
							artifact: makeArtifact({
								artifactId: 'artifact:knowledge-reveal-1',
								tag: 'knowledge_reveal_result',
								format: 'json',
							}),
						},
					},
				},
			],
			meta: {},
			version: 1,
			createdAt: '2026-03-21T00:00:00.000Z',
			updatedAt: '2026-03-21T00:00:00.000Z',
		};

		const form = toOperationProfileForm(profile);

		expect(form.operations[0]).toMatchObject({
			kind: 'knowledge_search',
			config: {
				params: {
					sourceMode: 'inline',
					requestTemplate: '{"textQuery":"forest","limit":5}',
					strictVariables: true,
					artifactTag: '',
					artifact: expect.objectContaining({
						format: 'json',
					}),
				},
			},
		});
		expect(form.operations[1]).toMatchObject({
			kind: 'knowledge_reveal',
			config: {
				params: {
					sourceMode: 'artifact',
					requestTemplate: '',
					strictVariables: false,
					artifactTag: 'planner_result',
					artifact: expect.objectContaining({
						format: 'json',
					}),
				},
			},
		});
	});

	it('serializes knowledge operations back to dto shape', () => {
		const values: OperationProfileFormValues = {
			name: 'Knowledge profile',
			description: '',
			enabled: true,
			executionMode: 'concurrent',
			operationProfileSessionId: 'session-knowledge',
			operations: [
				{
					opId: 'knowledge-search-1',
					name: 'Knowledge Search',
					description: '',
					kind: 'knowledge_search',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate', 'regenerate'],
						activation: { everyNTurns: 0, everyNContextTokens: 0 },
						order: 10,
						dependsOn: [],
						runConditions: [],
						params: {
							sourceMode: 'inline',
							requestTemplate: '{"textQuery":"dark forest"}',
							strictVariables: true,
							artifactTag: '',
							artifact: makeArtifact({
								artifactId: 'artifact:knowledge-search-1',
								tag: 'knowledge_search_result',
								format: 'json',
							}),
						},
					},
				},
				{
					opId: 'knowledge-reveal-1',
					name: 'Knowledge Reveal',
					description: '',
					kind: 'knowledge_reveal',
					config: {
						enabled: true,
						required: false,
						hooks: ['before_main_llm'],
						triggers: ['generate'],
						activation: { everyNTurns: 0, everyNContextTokens: 0 },
						order: 20,
						dependsOn: ['knowledge-search-1'],
						runConditions: [],
						params: {
							sourceMode: 'artifact',
							requestTemplate: '',
							strictVariables: false,
							artifactTag: 'planner_result',
							artifact: makeArtifact({
								artifactId: 'artifact:knowledge-reveal-1',
								tag: 'knowledge_reveal_result',
								format: 'json',
							}),
						},
					},
				},
			],
		};

		const result = fromOperationProfileForm(values, { validateJson: true });

		expect(result.operations[0]).toMatchObject({
			kind: 'knowledge_search',
			config: {
				params: {
					params: {
						source: {
							mode: 'inline',
							requestTemplate: '{"textQuery":"dark forest"}',
							strictVariables: true,
						},
					},
				},
			},
		});
		expect(result.operations[1]).toMatchObject({
			kind: 'knowledge_reveal',
			config: {
				dependsOn: ['knowledge-search-1'],
				params: {
					params: {
						source: {
							mode: 'artifact',
							artifactTag: 'planner_result',
						},
					},
				},
			},
		});
	});
});
