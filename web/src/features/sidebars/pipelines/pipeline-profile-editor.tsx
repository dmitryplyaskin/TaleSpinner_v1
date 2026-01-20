import { Alert, Button, Divider, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { LuCopyPlus, LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import type { PipelineDefinitionV1, PipelineProfileSpecV1, PipelineStepDefinitionV1 } from '@shared/types/pipeline-profile-spec';
import type { PipelineStepType } from '@shared/types/pipeline-execution';

import {
	$pipelineProfiles,
	$selectedPipelineProfileId,
	createPipelineProfileFx,
	deletePipelineProfileFx,
	duplicatePipelineProfileRequested,
	selectPipelineProfileForEdit,
	updatePipelineProfileFx,
} from '@model/pipeline-runtime';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { ProfilePipelineItem } from './profile-pipeline-item';

function isObject(v: unknown): v is Record<string, unknown> {
	return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

type PipelineStepForm = Omit<PipelineStepDefinitionV1, 'params'> & { paramsJson: string };
type PipelineDefinitionForm = Omit<PipelineDefinitionV1, 'steps'> & { steps: PipelineStepForm[] };

type FormValues = {
	name: string;
	pipelines: PipelineDefinitionForm[];
};

function isStepType(v: unknown): v is PipelineStepType {
	return v === 'pre' || v === 'llm' || v === 'post';
}

function isPipelineProfileSpecV1(spec: unknown): spec is PipelineProfileSpecV1 {
	if (!isObject(spec)) return false;
	if (spec.spec_version !== 1) return false;
	if (!Array.isArray((spec as any).pipelines)) return false;
	return true;
}

function stepTypeOrder(t: PipelineStepType): number {
	switch (t) {
		case 'pre':
			return 0;
		case 'llm':
			return 1;
		case 'post':
			return 2;
		default:
			return 99;
	}
}

function makeDefaultStep(stepType: PipelineStepType): PipelineStepForm {
	const defaultsByType: Record<PipelineStepType, Record<string, unknown>> = {
		pre: {
			notes: 'Draft config (Phase 2+: PromptDraft assembly, artifact writes)',
			artifacts: [],
		},
		llm: {
			notes: 'Draft config (Phase 1 boundary: settings passthrough; Phase 2+: prompt snapshot/hash)',
			kind: 'main',
		},
		post: {
			notes: 'Draft config (Phase 5+: canonicalization/blocks/state)',
			artifacts: [],
		},
	};

	return {
		id: uuidv4(),
		stepName: stepType,
		stepType,
		enabled: true,
		paramsJson: JSON.stringify(defaultsByType[stepType], null, 2),
	};
}

function ensureDefaultSteps(steps: PipelineStepForm[]): PipelineStepForm[] {
	const byType = new Map<PipelineStepType, PipelineStepForm>();
	for (const s of steps) {
		if (isStepType(s.stepType) && !byType.has(s.stepType)) byType.set(s.stepType, s);
	}
	for (const t of ['pre', 'llm', 'post'] as const) {
		if (!byType.has(t)) byType.set(t, makeDefaultStep(t));
	}
	return Array.from(byType.values()).sort((a, b) => stepTypeOrder(a.stepType) - stepTypeOrder(b.stepType));
}

function getPipelinesFromSpecV1(spec: unknown): PipelineDefinitionForm[] {
	if (!isPipelineProfileSpecV1(spec)) return [];

	const defs = spec.pipelines ?? [];
	const pipelines: PipelineDefinitionForm[] = [];

	for (const def of defs) {
		if (!isObject(def)) continue;
		const d = def as unknown as PipelineDefinitionV1;
		const rawSteps = Array.isArray(d.steps) ? d.steps : [];
		const steps: PipelineStepForm[] = rawSteps
			.filter((s) => isObject(s) && isStepType((s as any).stepType))
			.map((s) => {
				const step = s as unknown as PipelineStepDefinitionV1;
				const params = isObject(step.params) ? step.params : {};
				return {
					id: typeof step.id === 'string' ? step.id : uuidv4(),
					stepName: typeof step.stepName === 'string' ? step.stepName : String(step.stepType),
					stepType: step.stepType,
					enabled: Boolean(step.enabled),
					paramsJson: JSON.stringify(params, null, 2),
				};
			});

		pipelines.push({
			id: typeof d.id === 'string' ? d.id : uuidv4(),
			name: typeof d.name === 'string' ? d.name : 'Pipeline',
			enabled: Boolean(d.enabled),
			steps: ensureDefaultSteps(steps),
		});
	}

	return pipelines;
}

function createEmptyPipelineDefinition(): PipelineDefinitionForm {
	return {
		id: uuidv4(),
		name: 'New pipeline',
		enabled: true,
		steps: ensureDefaultSteps([]),
	};
}

function toProfileSpecV1FromForm(pipelines: PipelineDefinitionForm[]): PipelineProfileSpecV1 {
	return {
		spec_version: 1,
		pipelines: pipelines.map((p): PipelineDefinitionV1 => {
			const steps: PipelineStepDefinitionV1[] = p.steps
				.filter((s) => isStepType(s.stepType))
				.map((s) => {
					let parsed: unknown = {};
					try {
						parsed = s.paramsJson?.trim() ? JSON.parse(s.paramsJson) : {};
					} catch {
						parsed = {};
					}
					const params = isObject(parsed) ? parsed : {};
					return {
						id: s.id,
						stepName: s.stepName,
						stepType: s.stepType,
						enabled: Boolean(s.enabled),
						params,
					};
				})
				.sort((a, b) => stepTypeOrder(a.stepType) - stepTypeOrder(b.stepType));

			return { id: p.id, name: p.name, enabled: Boolean(p.enabled), steps };
		}),
	};
}

export const PipelineProfileEditor: React.FC = () => {
	const [profiles, selectedId] = useUnit([$pipelineProfiles, $selectedPipelineProfileId]);
	const doSelect = useUnit(selectPipelineProfileForEdit);
	const doCreate = useUnit(createPipelineProfileFx);
	const doUpdate = useUnit(updatePipelineProfileFx);
	const doDelete = useUnit(deletePipelineProfileFx);
	const doDuplicate = useUnit(duplicatePipelineProfileRequested);

	const selectedProfile = useMemo(() => profiles.find((p) => p.id === selectedId) ?? null, [profiles, selectedId]);
	const [jsonError, setJsonError] = useState<string | null>(null);

	const initialValues = useMemo<FormValues>(() => {
		if (!selectedProfile) return { name: '', pipelines: [] };
		return { name: selectedProfile.name, pipelines: getPipelinesFromSpecV1(selectedProfile.spec) };
	}, [selectedProfile]);

	const methods = useForm<FormValues>({ defaultValues: initialValues });
	const { control, formState } = methods;

	const { fields, append, remove, move } = useFieldArray({
		name: 'pipelines',
		control,
		// PipelineDefinitionForm already has `id`; avoid react-hook-form collision with its internal key.
		keyName: '_key',
	});

	useEffect(() => {
		setJsonError(null);
		methods.reset(initialValues);
	}, [initialValues]);

	const profileOptions = [
		{ value: '', label: '(нет / не выбрано)' },
		...profiles.map((p) => ({ value: p.id, label: `${p.name} (v${p.version})` })),
	];

	const onSave = methods.handleSubmit((values) => {
		if (!selectedProfile?.id) return;
		// Validate JSON for step params.
		for (const p of values.pipelines) {
			for (const s of p.steps) {
				const raw = s.paramsJson?.trim() ?? '';
				if (!raw) continue;
				try {
					const parsed = JSON.parse(raw) as unknown;
					if (!isObject(parsed)) {
						setJsonError(`Step params must be a JSON object. Pipeline="${p.name}", stepType="${s.stepType}"`);
						return;
					}
				} catch (e) {
					setJsonError(
						`Invalid JSON in step params. Pipeline="${p.name}", stepType="${s.stepType}": ${
							e instanceof Error ? e.message : String(e)
						}`,
					);
					return;
				}
			}
		}

		const nextSpec = toProfileSpecV1FromForm(values.pipelines);
		doUpdate({ id: selectedProfile.id, name: values.name, spec: nextSpec });
	});

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Alert color="blue" title="UI-заглушка (v1)">
					Это редактор `PipelineProfile.spec` (спека v0.1): `pipelines[]` → `steps[] (pre/llm/post)` → `params` (пока как JSON-заглушка).
				</Alert>

				<Stack gap="xs">
					<Text fw={700}>Профили (пресеты)</Text>

					<Group justify="space-between" wrap="nowrap" align="flex-end">
						<Select
							label="Редактировать профиль"
							data={profileOptions}
							value={selectedId ?? ''}
							onChange={(v) => doSelect(v && v !== '' ? v : null)}
							comboboxProps={{ withinPortal: false }}
							style={{ flex: 1 }}
						/>

						<Group gap="xs" wrap="nowrap">
							<IconButtonWithTooltip
								aria-label="Create profile"
								tooltip="Создать профиль"
								icon={<LuPlus />}
								onClick={() => doCreate({ name: 'New profile', spec: { spec_version: 1, pipelines: [] } })}
							/>
							<IconButtonWithTooltip
								aria-label="Duplicate profile"
								tooltip="Дублировать профиль"
								icon={<LuCopyPlus />}
								disabled={!selectedProfile?.id}
								onClick={() => selectedProfile?.id && doDuplicate({ sourceProfileId: selectedProfile.id })}
							/>
							<IconButtonWithTooltip
								aria-label="Delete profile"
								tooltip="Удалить профиль"
								icon={<LuTrash2 />}
								colorPalette="red"
								disabled={!selectedProfile?.id}
								onClick={() => {
									if (!selectedProfile?.id) return;
									if (!window.confirm('Удалить PipelineProfile?')) return;
									doDelete({ id: selectedProfile.id });
								}}
							/>
						</Group>
					</Group>

					<TextInput
						label="Название"
						disabled={!selectedProfile?.id}
						value={methods.watch('name')}
						onChange={(e) => methods.setValue('name', e.currentTarget.value, { shouldDirty: true })}
					/>

					<Group justify="flex-end">
						<Button
							leftSection={<LuSave />}
							disabled={!selectedProfile?.id || !formState.isDirty}
							onClick={onSave}
						>
							Сохранить
						</Button>
					</Group>
				</Stack>

				<Divider />

				<Stack gap="xs">
					<Group justify="space-between" align="center" wrap="nowrap">
						<Text fw={700}>Pipelines (profile spec)</Text>
						<Button
							size="xs"
							variant="light"
							leftSection={<LuPlus />}
							disabled={!selectedProfile?.id}
							onClick={() => append(createEmptyPipelineDefinition())}
						>
							Добавить
						</Button>
					</Group>

					{jsonError && (
						<Alert color="red" title="Ошибка JSON">
							{jsonError}
						</Alert>
					)}

					{!selectedProfile?.id ? (
						<Text size="sm" c="dimmed">
							Выберите или создайте профиль, чтобы редактировать пайплайны.
						</Text>
					) : fields.length === 0 ? (
						<Text size="sm" c="dimmed">
							Пока пусто. Нажмите “Добавить”.
						</Text>
					) : (
						<Stack gap="sm">
							{fields.map((f, idx) => (
								<ProfilePipelineItem
									key={f._key}
									index={idx}
									isFirst={idx === 0}
									isLast={idx === fields.length - 1}
									onMoveUp={() => move(idx, idx - 1)}
									onMoveDown={() => move(idx, idx + 1)}
									onRemove={() => remove(idx)}
								/>
							))}
						</Stack>
					)}
				</Stack>
			</Stack>
		</FormProvider>
	);
};

