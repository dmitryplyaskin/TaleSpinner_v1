import { Alert, Button, Card, Collapse, Divider, Group, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { LuChevronDown, LuChevronUp, LuPlus, LuRotateCcw, LuSave } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../api/chat-core';

import { updateOperationProfileFx } from '@model/operation-profiles';
import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from './form/operation-profile-form-mapping';
import { OperationEditor } from './ui/operation-editor/operation-editor';
import { OperationList } from './ui/operation-list';

export const OperationProfileEditor: React.FC<{ profile: OperationProfileDto }> = ({ profile }) => {
	const doUpdate = useUnit(updateOperationProfileFx);

	const initial = useMemo(() => toOperationProfileForm(profile), [profile]);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, formState } = methods;

	const { fields, append, remove } = useFieldArray({
		name: 'operations',
		control,
		keyName: '_key',
	});

	const [isProfileOpen, setIsProfileOpen] = useState(true);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [editingOpId, setEditingOpId] = useState<string | null>(() => initial.operations[0]?.opId ?? null);

	useEffect(() => {
		setJsonError(null);
		methods.reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	}, [initial]);

	const onSave = methods.handleSubmit((values) => {
		setJsonError(null);
		try {
			const payload = fromOperationProfileForm(values, { validateJson: true });
			doUpdate({ profileId: profile.profileId, patch: payload });
		} catch (e) {
			setJsonError(e instanceof Error ? e.message : String(e));
		}
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

				<Stack gap="xs">
					<Group justify="space-between" align="center" wrap="nowrap">
						<Text fw={700}>Операции</Text>
						<Button
							size="xs"
							variant="light"
							leftSection={<LuPlus />}
							onClick={() => {
								const op = makeDefaultOperation();
								append(op);
								setEditingOpId(op.opId);
							}}
						>
							Добавить
						</Button>
					</Group>

					{jsonError && (
						<Alert color="red" title="Ошибка JSON">
							{jsonError}
						</Alert>
					)}

					{fields.length === 0 ? (
						<Text size="sm" c="dimmed">
							Пока пусто. Нажмите “Добавить”.
						</Text>
					) : (
						(() => {
							const items = fields
								.map((f, idx) => ({ opId: f.opId, index: idx }))
								.filter((x): x is { opId: string; index: number } => typeof x.opId === 'string' && x.opId.length > 0);

							const selectedIndex =
								editingOpId && items.some((i) => i.opId === editingOpId)
									? items.find((i) => i.opId === editingOpId)!.index
									: items[0]!.index;

							const selectedOpId = items.find((i) => i.index === selectedIndex)?.opId ?? null;

							return (
								<Group align="flex-start" wrap="wrap" gap="md">
									<Stack gap="xs" style={{ flex: '0 0 360px', width: 360, maxWidth: '100%' }}>
										<Text size="xs" c="dimmed">
											Список операций (кликните, чтобы редактировать)
										</Text>
										<OperationList items={items} selectedOpId={selectedOpId} onSelect={setEditingOpId} />
									</Stack>

									<Stack gap="xs" style={{ flex: '1 1 520px', minWidth: 320 }}>
										<Group justify="space-between" wrap="nowrap">
											<Text fw={600}>Editor</Text>
											<Text size="xs" c="dimmed">
												#{selectedIndex + 1}
											</Text>
										</Group>

										<OperationEditor
											index={selectedIndex}
											onRemove={() => {
												const removedOpId = selectedOpId;
												const next =
													items.find((i) => i.index === selectedIndex + 1)?.opId ??
													items.find((i) => i.index === selectedIndex - 1)?.opId ??
													null;
												remove(selectedIndex);
												if (removedOpId && removedOpId === editingOpId) setEditingOpId(next);
												if (!removedOpId) setEditingOpId(next);
											}}
										/>
									</Stack>
								</Group>
							);
						})()
					)}
				</Stack>
			</Stack>
		</FormProvider>
	);
};

