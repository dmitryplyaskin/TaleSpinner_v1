import { Button, Card, Collapse, Divider, Group, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { LuChevronDown, LuChevronUp, LuPlus, LuRotateCcw, LuSave } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../api/chat-core';
import type { OperationConfig, OperationInProfile, OperationTemplateParams } from '@shared/types/operation-profiles';

import { updateOperationProfileFx } from '@model/operation-profiles';
import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { OperationDepsOptionsProvider } from './operation-deps-options';
import { OperationItem } from './operation-item';

type FormOperation = OperationInProfile & {
	config: OperationConfig & {
		params: OperationTemplateParams & {
			strictVariables: boolean;
		};
		triggers: Array<'generate' | 'regenerate'>;
		hooks: Array<'before_main_llm' | 'after_main_llm'>;
		dependsOn: string[];
	};
};

type FormValues = {
	name: string;
	description: string;
	enabled: boolean;
	executionMode: 'concurrent' | 'sequential';
	operationProfileSessionId: string;
	operations: FormOperation[];
};

function normalizeTemplateParams(params: unknown): OperationTemplateParams {
	if (!params || typeof params !== 'object') {
		return {
			template: '',
			strictVariables: false,
			output: {
				type: 'artifacts',
				writeArtifact: {
					tag: 'artifact',
					persistence: 'run_only',
					usage: 'internal',
					semantics: 'intermediate',
				},
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
				tag: 'artifact',
				persistence: 'run_only',
				usage: 'internal',
				semantics: 'intermediate',
			},
		},
	};
}

function toForm(profile: OperationProfileDto): FormValues {
	return {
		name: profile.name,
		description: profile.description ?? '',
		enabled: profile.enabled,
		executionMode: profile.executionMode,
		operationProfileSessionId: profile.operationProfileSessionId,
		operations: (profile.operations ?? []).map((op): FormOperation => ({
			...op,
			config: {
				...op.config,
				hooks: (op.config.hooks?.length ? op.config.hooks : ['before_main_llm']) as any,
				triggers: (op.config.triggers?.length ? op.config.triggers : ['generate', 'regenerate']) as any,
				dependsOn: op.config.dependsOn ?? [],
				params: {
					...normalizeTemplateParams(op.config.params as unknown),
					strictVariables: Boolean((op.config.params as any)?.strictVariables),
				},
			},
		})),
	};
}

function fromForm(values: FormValues): { name: string; description?: string; enabled: boolean; executionMode: 'concurrent' | 'sequential'; operationProfileSessionId: string; operations: OperationInProfile[] } {
	return {
		name: values.name,
		description: values.description.trim() ? values.description.trim() : undefined,
		enabled: values.enabled,
		executionMode: values.executionMode,
		operationProfileSessionId: values.operationProfileSessionId,
		operations: values.operations.map((op): OperationInProfile => ({
			opId: op.opId,
			name: op.name,
			kind: 'template',
			config: {
				enabled: Boolean(op.config.enabled),
				required: Boolean(op.config.required),
				hooks: op.config.hooks,
				triggers: op.config.triggers,
				order: Number(op.config.order),
				dependsOn: op.config.dependsOn?.length ? op.config.dependsOn : undefined,
				params: {
					template: op.config.params.template,
					strictVariables: op.config.params.strictVariables ? true : undefined,
					output: op.config.params.output,
				},
			},
		})),
	};
}

function makeDefaultOperation(): FormOperation {
	return {
		opId: uuidv4(),
		name: 'New operation',
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
				output: {
					type: 'artifacts',
					writeArtifact: {
						tag: `artifact_${Math.random().toString(16).slice(2, 8)}`,
						persistence: 'run_only',
						usage: 'internal',
						semantics: 'intermediate',
					},
				},
			},
		},
	};
}

export const OperationProfileEditor: React.FC<{ profile: OperationProfileDto }> = ({ profile }) => {
	const doUpdate = useUnit(updateOperationProfileFx);

	const initial = useMemo(() => toForm(profile), [profile]);
	const methods = useForm<FormValues>({ defaultValues: initial });
	const { control, formState } = methods;

	const { fields, append, remove } = useFieldArray({
		name: 'operations',
		control,
		keyName: '_key',
	});

	const [depsKey, setDepsKey] = useState(0);
	const [isProfileOpen, setIsProfileOpen] = useState(true);

	useEffect(() => {
		methods.reset(initial);
		setDepsKey((v) => v + 1);
	}, [initial]);

	const onSave = methods.handleSubmit((values) => {
		const payload = fromForm(values);
		doUpdate({ profileId: profile.profileId, patch: payload });
	});

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Card withBorder>
					<Group
						justify="space-between"
						align="center"
						wrap="nowrap"
						style={{ cursor: 'pointer' }}
						onClick={() => setIsProfileOpen((v) => !v)}
					>
						<Group gap="xs" wrap="nowrap">
							{isProfileOpen ? <LuChevronDown /> : <LuChevronUp />}
							<Text fw={700}>Профиль</Text>
						</Group>

						<Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
							<IconButtonWithTooltip
								aria-label="Save profile"
								tooltip="Сохранить"
								icon={<LuSave />}
								disabled={!formState.isDirty}
								onClick={onSave}
							/>
							<IconButtonWithTooltip
								aria-label="Reset session id"
								tooltip="Сбросить operationProfileSessionId"
								icon={<LuRotateCcw />}
								variant="ghost"
								onClick={() => methods.setValue('operationProfileSessionId', uuidv4(), { shouldDirty: true })}
							/>
						</Group>
					</Group>

					<Collapse in={isProfileOpen}>
						<Stack gap="xs" pt="md">
							<FormInput name="name" label="Название" inputProps={{ style: { flex: 1 } }} />
							<FormInput name="description" label="Описание" />

							<Group gap="md" wrap="wrap">
								<FormSwitch name="enabled" label="Профиль включён" />
								<FormSelect
									name="executionMode"
									label="Execution mode"
									selectProps={{
										comboboxProps: { withinPortal: false },
										style: { width: 220 },
										options: [
											{ value: 'concurrent', label: 'concurrent' },
											{ value: 'sequential', label: 'sequential' },
										],
									}}
								/>
							</Group>

							<FormInput
								name="operationProfileSessionId"
								label="operationProfileSessionId"
								infoTip="Resettable session id used to group related changes/validation scope for this profile."
							/>
						</Stack>
					</Collapse>
				</Card>

				<Divider />

				<OperationDepsOptionsProvider>
					<Stack gap="xs">
						<Group justify="space-between" align="center" wrap="nowrap">
							<Text fw={700}>Операции</Text>
							<Button
								size="xs"
								variant="light"
								leftSection={<LuPlus />}
								onClick={() => {
									append(makeDefaultOperation());
									setDepsKey((v) => v + 1);
								}}
							>
								Добавить
							</Button>
						</Group>

						{fields.length === 0 ? (
							<Text size="sm" c="dimmed">
								Пока пусто. Нажмите “Добавить”.
							</Text>
						) : (
							<Stack gap="sm">
								{fields.map((f, idx) => (
									<OperationItem
										key={f._key}
										index={idx}
										depsKey={depsKey}
										onRemove={() => {
											remove(idx);
											setDepsKey((v) => v + 1);
										}}
									/>
								))}
							</Stack>
						)}
					</Stack>
				</OperationDepsOptionsProvider>
			</Stack>
		</FormProvider>
	);
};

