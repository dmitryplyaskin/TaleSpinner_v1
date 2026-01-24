import { Button, Card, Checkbox, Divider, Group, MultiSelect, NumberInput, Select, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../api/chat-core';
import type { OperationConfig, OperationInProfile, OperationTemplateParams } from '@shared/types/operation-profiles';

import { updateOperationProfileFx } from '@model/operation-profiles';

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
					...op.config.params,
					strictVariables: Boolean(op.config.params.strictVariables),
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
					writeArtifact: op.config.params.writeArtifact,
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
				writeArtifact: {
					tag: `artifact_${Math.random().toString(16).slice(2, 8)}`,
					persistence: 'run_only',
					usage: 'internal',
					semantics: 'intermediate',
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

	useEffect(() => {
		methods.reset(initial);
		setDepsKey((v) => v + 1);
	}, [initial]);

	const ops = methods.watch('operations');
	const depOptions = (ops ?? []).map((o) => ({ value: o.opId, label: `${o.name} — ${o.opId}` }));

	const onSave = methods.handleSubmit((values) => {
		const payload = fromForm(values);
		doUpdate({ profileId: profile.profileId, patch: payload });
	});

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Card withBorder>
					<Stack gap="xs">
						<Text fw={700}>Профиль</Text>
						<Group wrap="nowrap" align="flex-end">
							<TextInput
								label="Название"
								style={{ flex: 1 }}
								value={methods.watch('name')}
								onChange={(e) => methods.setValue('name', e.currentTarget.value, { shouldDirty: true })}
							/>
							<Button leftSection={<LuSave />} disabled={!formState.isDirty} onClick={onSave}>
								Сохранить
							</Button>
						</Group>
						<TextInput
							label="Описание"
							value={methods.watch('description')}
							onChange={(e) => methods.setValue('description', e.currentTarget.value, { shouldDirty: true })}
						/>

						<Group gap="md">
							<Switch
								checked={methods.watch('enabled')}
								onChange={(e) => methods.setValue('enabled', e.currentTarget.checked, { shouldDirty: true })}
								label="Профиль включён"
							/>
							<Select
								label="Execution mode"
								data={[
									{ value: 'concurrent', label: 'concurrent' },
									{ value: 'sequential', label: 'sequential' },
								]}
								value={methods.watch('executionMode')}
								onChange={(v) => v && methods.setValue('executionMode', v as any, { shouldDirty: true })}
								comboboxProps={{ withinPortal: false }}
								style={{ width: 220 }}
							/>
						</Group>

						<Group wrap="nowrap" align="flex-end">
							<TextInput
								label="operationProfileSessionId"
								style={{ flex: 1 }}
								value={methods.watch('operationProfileSessionId')}
								onChange={(e) => methods.setValue('operationProfileSessionId', e.currentTarget.value, { shouldDirty: true })}
							/>
							<Button
								variant="light"
								onClick={() => methods.setValue('operationProfileSessionId', uuidv4(), { shouldDirty: true })}
							>
								Reset
							</Button>
						</Group>
					</Stack>
				</Card>

				<Divider />

				<Stack gap="xs">
					<Group justify="space-between" align="center" wrap="nowrap">
						<Text fw={700}>Operations</Text>
						<Button size="xs" variant="light" leftSection={<LuPlus />} onClick={() => append(makeDefaultOperation())}>
							Добавить
						</Button>
					</Group>

					{fields.length === 0 ? (
						<Text size="sm" c="dimmed">
							Пока пусто. Нажмите “Добавить”.
						</Text>
					) : (
						<Stack gap="sm">
							{fields.map((f, idx) => {
								const base = ops?.[idx];
								return (
									<Card key={f._key} withBorder>
										<Stack gap="xs">
											<Group justify="space-between" wrap="nowrap" align="flex-end">
												<TextInput
													label="Operation name"
													style={{ flex: 1 }}
													value={base?.name ?? ''}
													onChange={(e) => methods.setValue(`operations.${idx}.name`, e.currentTarget.value, { shouldDirty: true })}
												/>
												<Button
													leftSection={<LuTrash2 />}
													color="red"
													variant="outline"
													onClick={() => remove(idx)}
												>
													Удалить
												</Button>
											</Group>

											<Text size="xs" c="dimmed">
												opId: {base?.opId}
											</Text>

											<Group grow>
												<Checkbox
													label="enabled"
													checked={Boolean(base?.config.enabled)}
													onChange={(e) => methods.setValue(`operations.${idx}.config.enabled`, e.currentTarget.checked, { shouldDirty: true })}
												/>
												<Checkbox
													label="required"
													checked={Boolean(base?.config.required)}
													onChange={(e) => methods.setValue(`operations.${idx}.config.required`, e.currentTarget.checked, { shouldDirty: true })}
												/>
											</Group>

											<Group grow>
												<Select
													label="hook"
													data={[
														{ value: 'before_main_llm', label: 'before_main_llm' },
														{ value: 'after_main_llm', label: 'after_main_llm' },
													]}
													value={base?.config.hooks?.[0] ?? 'before_main_llm'}
													onChange={(v) => v && methods.setValue(`operations.${idx}.config.hooks`, [v as any], { shouldDirty: true })}
													comboboxProps={{ withinPortal: false }}
												/>
												<MultiSelect
													key={depsKey}
													label="triggers"
													data={[
														{ value: 'generate', label: 'generate' },
														{ value: 'regenerate', label: 'regenerate' },
													]}
													value={base?.config.triggers ?? ['generate', 'regenerate']}
													onChange={(v) => methods.setValue(`operations.${idx}.config.triggers`, v as any, { shouldDirty: true })}
													comboboxProps={{ withinPortal: false }}
												/>
											</Group>

											<Group grow>
												<NumberInput
													label="order"
													value={base?.config.order ?? 0}
													onChange={(v) => methods.setValue(`operations.${idx}.config.order`, Number(v ?? 0), { shouldDirty: true })}
												/>
												<MultiSelect
													key={`${depsKey}-${idx}`}
													label="dependsOn"
													data={depOptions.filter((o) => o.value !== base?.opId)}
													value={base?.config.dependsOn ?? []}
													onChange={(v) => methods.setValue(`operations.${idx}.config.dependsOn`, v, { shouldDirty: true })}
													comboboxProps={{ withinPortal: false }}
													placeholder="Нет"
													searchable
												/>
											</Group>

											<Divider />

											<Stack gap="xs">
												<Text fw={600}>Template</Text>
												<Group grow>
													<Checkbox
														label="strictVariables"
														checked={Boolean(base?.config.params.strictVariables)}
														onChange={(e) => methods.setValue(`operations.${idx}.config.params.strictVariables`, e.currentTarget.checked, { shouldDirty: true })}
													/>
												</Group>
												<Textarea
													label="template"
													minRows={4}
													autosize
													value={base?.config.params.template ?? ''}
													onChange={(e) => methods.setValue(`operations.${idx}.config.params.template`, e.currentTarget.value, { shouldDirty: true })}
												/>
											</Stack>

											<Divider />

											<Stack gap="xs">
												<Text fw={600}>writeArtifact</Text>
												<Group grow>
													<TextInput
														label="tag"
														value={base?.config.params.writeArtifact.tag ?? ''}
														onChange={(e) => methods.setValue(`operations.${idx}.config.params.writeArtifact.tag`, e.currentTarget.value, { shouldDirty: true })}
													/>
													<Select
														label="persistence"
														data={[
															{ value: 'persisted', label: 'persisted' },
															{ value: 'run_only', label: 'run_only' },
														]}
														value={base?.config.params.writeArtifact.persistence ?? 'run_only'}
														onChange={(v) =>
															v && methods.setValue(`operations.${idx}.config.params.writeArtifact.persistence`, v as any, { shouldDirty: true })
														}
														comboboxProps={{ withinPortal: false }}
													/>
												</Group>
												<Group grow>
													<Select
														label="usage"
														data={[
															{ value: 'prompt_only', label: 'prompt_only' },
															{ value: 'ui_only', label: 'ui_only' },
															{ value: 'prompt+ui', label: 'prompt+ui' },
															{ value: 'internal', label: 'internal' },
														]}
														value={base?.config.params.writeArtifact.usage ?? 'internal'}
														onChange={(v) =>
															v && methods.setValue(`operations.${idx}.config.params.writeArtifact.usage`, v as any, { shouldDirty: true })
														}
														comboboxProps={{ withinPortal: false }}
													/>
													<TextInput
														label="semantics"
														value={base?.config.params.writeArtifact.semantics ?? 'intermediate'}
														onChange={(e) =>
															methods.setValue(`operations.${idx}.config.params.writeArtifact.semantics`, e.currentTarget.value, { shouldDirty: true })
														}
													/>
												</Group>
											</Stack>
										</Stack>
									</Card>
								);
							})}
						</Stack>
					)}
				</Stack>
			</Stack>
		</FormProvider>
	);
};

