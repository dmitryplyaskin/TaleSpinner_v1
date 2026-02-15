import { ActionIcon, Alert, Button, Card, Group, NumberInput, Select, Stack, Switch, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import { updateOperationProfileFx } from '@model/operation-profiles';
import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';

import type { OperationBlockDto, OperationProfileDto } from '../../../api/chat-core';
import type { OperationProfileUpsertInput } from '@shared/types/operation-profiles';

export type OperationProfileBlocksToolbarState = {
	canSave: boolean;
	canDiscard: boolean;
	onSave: () => void;
	onDiscard: () => void;
	onResetSessionId: () => void;
};

type Props = {
	profile: OperationProfileDto;
	blocks: OperationBlockDto[];
	onEditBlock?: (blockId: string) => void;
	onToolbarStateChange?: (state: OperationProfileBlocksToolbarState | null) => void;
};

type FormValues = OperationProfileUpsertInput;

function toFormValues(profile: OperationProfileDto): FormValues {
	return {
		name: profile.name,
		description: profile.description,
		enabled: profile.enabled,
		executionMode: profile.executionMode,
		operationProfileSessionId: profile.operationProfileSessionId,
		blockRefs: profile.blockRefs ?? [],
		meta: profile.meta ?? undefined,
	};
}

export const OperationProfileBlocksEditor: React.FC<Props> = ({ profile, blocks, onEditBlock, onToolbarStateChange }) => {
	const { t } = useTranslation();
	const doUpdate = useUnit(updateOperationProfileFx);
	const [error, setError] = useState<string | null>(null);
	const [newBlockId, setNewBlockId] = useState<string | null>(null);

	const initial = useMemo(() => toFormValues(profile), [profile]);
	const methods = useForm<FormValues>({ defaultValues: initial });
	const { control, formState, reset, handleSubmit, setValue } = methods;
	const { fields, append, remove, move } = useFieldArray({
		control,
		name: 'blockRefs',
		keyName: '_key',
	});
	const watchedBlockRefs = useWatch({ control, name: 'blockRefs' });

	useEffect(() => {
		reset(initial);
		setError(null);
	}, [initial, reset]);

	const availableBlockOptions = useMemo(() => {
		const linked = new Set((watchedBlockRefs ?? []).map((ref) => ref.blockId));
		return blocks
			.filter((b) => !linked.has(b.blockId))
			.map((b) => ({ value: b.blockId, label: b.name }));
	}, [blocks, watchedBlockRefs]);

	const onSave = useMemo(
		() =>
			handleSubmit((values) => {
				setError(null);
				doUpdate({ profileId: profile.profileId, patch: values });
			}),
		[doUpdate, handleSubmit, profile.profileId],
	);

	const onDiscard = useCallback(() => {
		setError(null);
		reset(initial);
	}, [initial, reset]);

	const onResetSessionId = useCallback(() => {
		setValue('operationProfileSessionId', uuidv4(), { shouldDirty: true });
	}, [setValue]);

	useEffect(() => {
		onToolbarStateChange?.({
			canSave: formState.isDirty,
			canDiscard: formState.isDirty,
			onSave,
			onDiscard,
			onResetSessionId,
		});
	}, [formState.isDirty, onDiscard, onResetSessionId, onSave, onToolbarStateChange]);

	useEffect(() => {
		return () => {
			onToolbarStateChange?.(null);
		};
	}, [onToolbarStateChange]);

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Card withBorder className="op-editorCard">
					<Stack gap="xs">
						<FormInput name="name" label={t('operationProfiles.profileSettings.profileName')} />
						<FormInput name="description" label={t('operationProfiles.sectionsLabels.description')} />
						<Group gap="md" wrap="wrap">
							<FormSwitch name="enabled" label={t('operationProfiles.profileSettings.profileEnabled')} />
							<FormSelect
								name="executionMode"
								label={t('operationProfiles.profileSettings.executionMode')}
								selectProps={{
									comboboxProps: { withinPortal: false },
									options: [
										{ value: 'concurrent', label: 'concurrent' },
										{ value: 'sequential', label: 'sequential' },
									],
									style: { width: 220 },
								}}
							/>
						</Group>
						<FormInput
							name="operationProfileSessionId"
							label={t('operationProfiles.profileSettings.sessionId')}
							infoTip={t('operationProfiles.profileSettings.sessionIdInfo')}
						/>
					</Stack>
				</Card>

				{error && (
					<Alert color="red" title={t('operationProfiles.profileSettings.invalidJson')}>
						{error}
					</Alert>
				)}

				<Card withBorder className="op-editorCard">
					<Stack gap="sm">
						<Text fw={700}>{t('operationProfiles.blocks.profileCompositionTitle')}</Text>
						<Group gap="xs" align="flex-end">
							<Select
								label={t('operationProfiles.blocks.addBlock')}
								placeholder={t('operationProfiles.blocks.selectBlock')}
								data={availableBlockOptions}
								value={newBlockId}
								onChange={setNewBlockId}
								comboboxProps={{ withinPortal: false }}
								style={{ flex: 1 }}
							/>
							<Button
								leftSection={<LuPlus />}
								disabled={!newBlockId}
								onClick={() => {
									if (!newBlockId) return;
									append({
										blockId: newBlockId,
										enabled: true,
										order: fields.length * 10,
									});
									setNewBlockId(null);
								}}
							>
								{t('common.add')}
							</Button>
						</Group>

						{fields.length === 0 ? (
							<Text size="sm" c="dimmed">
								{t('operationProfiles.blocks.emptyComposition')}
							</Text>
						) : (
							fields.map((field, index) => {
								const block = blocks.find((item) => item.blockId === field.blockId);
								return (
									<Card key={field._key} withBorder radius="md" p="sm">
										<Group justify="space-between" align="flex-start" wrap="nowrap">
											<Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
												<Text fw={600} lineClamp={1}>
													{block?.name ?? field.blockId}
												</Text>
												<Text size="xs" c="dimmed" lineClamp={1}>
													{field.blockId}
												</Text>
											</Stack>
											<Group gap={4} wrap="nowrap">
												<ActionIcon variant="subtle" onClick={() => index > 0 && move(index, index - 1)} disabled={index === 0}>
													<LuArrowUp size={16} />
												</ActionIcon>
												<ActionIcon
													variant="subtle"
													onClick={() => index < fields.length - 1 && move(index, index + 1)}
													disabled={index >= fields.length - 1}
												>
													<LuArrowDown size={16} />
												</ActionIcon>
												<ActionIcon
													variant="subtle"
													aria-label={t('operationProfiles.blocks.actions.editBlock')}
													title={t('operationProfiles.blocks.actions.editBlock')}
													disabled={!onEditBlock}
													onClick={() => onEditBlock?.(field.blockId)}
												>
													<LuPencil size={16} />
												</ActionIcon>
												<ActionIcon color="red" variant="subtle" onClick={() => remove(index)}>
													<LuTrash2 size={16} />
												</ActionIcon>
											</Group>
										</Group>

										<Group mt="xs" gap="md" wrap="wrap">
											<Switch
												label={t('operationProfiles.blocks.blockRefEnabled')}
												checked={Boolean(methods.watch(`blockRefs.${index}.enabled`))}
												onChange={(event) => {
													setValue(`blockRefs.${index}.enabled`, event.currentTarget.checked, { shouldDirty: true });
												}}
											/>
											<NumberInput
												label={t('operationProfiles.blocks.blockOrder')}
												value={Number(methods.watch(`blockRefs.${index}.order`) ?? 0)}
												onChange={(value) => {
													const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
													setValue(`blockRefs.${index}.order`, numeric, { shouldDirty: true });
												}}
												step={10}
												style={{ width: 160 }}
											/>
										</Group>
									</Card>
								);
							})
						)}
					</Stack>
				</Card>
			</Stack>
		</FormProvider>
	);
};
