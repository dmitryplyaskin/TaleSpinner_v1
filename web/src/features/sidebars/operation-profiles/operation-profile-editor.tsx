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

import { OperationDepsOptionsProvider } from './operation-deps-options';
import { OperationItem } from './operation-item';
import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from './operation-profile-form';

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

	const [depsKey, setDepsKey] = useState(0);
	const [isProfileOpen, setIsProfileOpen] = useState(true);
	const [jsonError, setJsonError] = useState<string | null>(null);

	useEffect(() => {
		setJsonError(null);
		methods.reset(initial);
		setDepsKey((v) => v + 1);
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

