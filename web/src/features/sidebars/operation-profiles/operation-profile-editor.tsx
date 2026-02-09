import { Alert, Button, Card, Collapse, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuPlus } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import { updateOperationProfileFx } from '@model/operation-profiles';
import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';

import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from './form/operation-profile-form-mapping';
import { OperationEditor } from './ui/operation-editor/operation-editor';
import { OperationList } from './ui/operation-list';

import type { OperationListItemVm, OperationStatsVm } from './ui/types';
import type { OperationProfileDto } from '../../../api/chat-core';
import type { OperationKind } from '@shared/types/operation-profiles';

function isOperationKind(value: unknown): value is OperationKind {
	return (
		value === 'template' ||
		value === 'llm' ||
		value === 'rag' ||
		value === 'tool' ||
		value === 'compute' ||
		value === 'transform' ||
		value === 'legacy'
	);
}

type Props = {
	profile: OperationProfileDto;
	preferSplitLayout: boolean;
	onToolbarStateChange?: (state: OperationProfileToolbarState | null) => void;
};

export type OperationProfileToolbarState = {
	canSave: boolean;
	canDiscard: boolean;
	onSave: () => void;
	onDiscard: () => void;
	onResetSessionId: () => void;
};

export const OperationProfileEditor: React.FC<Props> = ({ profile, preferSplitLayout, onToolbarStateChange }) => {
	const { t } = useTranslation();
	const doUpdate = useUnit(updateOperationProfileFx);
	const isMobile = useMediaQuery('(max-width: 767px)');
	const useSplitLayout = preferSplitLayout && !isMobile;

	const initial = useMemo(() => toOperationProfileForm(profile), [profile]);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, formState, reset, setValue } = methods;

	const { fields, append, remove } = useFieldArray({
		name: 'operations',
		control,
		keyName: '_key',
	});

	const watchedOperations = useWatch({ control, name: 'operations' }) as OperationProfileFormValues['operations'] | undefined;

	const [isProfileOpen, setIsProfileOpen] = useState(true);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [editingOpId, setEditingOpId] = useState<string | null>(() => initial.operations[0]?.opId ?? null);

	useEffect(() => {
		setJsonError(null);
		reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	}, [initial, reset]);

	const items = useMemo<OperationListItemVm[]>(() => {
		return fields
			.map((f, idx): OperationListItemVm | null => {
				if (typeof f.opId !== 'string' || f.opId.length === 0) return null;
				const watched = watchedOperations?.[idx];
				const rawKind = watched?.kind;
				return {
					opId: f.opId,
					index: idx,
					name: typeof watched?.name === 'string' && watched.name.trim() ? watched.name.trim() : t('operationProfiles.defaults.untitledOperation'),
					kind: isOperationKind(rawKind) ? rawKind : 'template',
					enabled: Boolean(watched?.config?.enabled),
					required: Boolean(watched?.config?.required),
					depsCount: Array.isArray(watched?.config?.dependsOn) ? watched.config.dependsOn.length : 0,
				};
			})
			.filter((item): item is OperationListItemVm => item !== null);
	}, [fields, t, watchedOperations]);

	const stats = useMemo<OperationStatsVm>(() => {
		return {
			total: items.length,
			enabled: items.filter((item) => item.enabled).length,
			required: items.filter((item) => item.required).length,
			withDeps: items.filter((item) => item.depsCount > 0).length,
			filtered: items.length,
		};
	}, [items]);

	const selectedIndex = useMemo(() => {
		if (items.length === 0) return null;
		if (editingOpId) {
			const match = items.find((item) => item.opId === editingOpId);
			if (match) return match.index;
		}
		return items[0]?.index ?? null;
	}, [editingOpId, items]);

	const selectedItem = selectedIndex === null ? null : items.find((item) => item.index === selectedIndex) ?? null;
	const selectedOpId = selectedItem?.opId ?? null;

	const submitValues = useCallback((values: OperationProfileFormValues) => {
		setJsonError(null);
		try {
			const payload = fromOperationProfileForm(values, { validateJson: true });
			doUpdate({ profileId: profile.profileId, patch: payload });
		} catch (error) {
			setJsonError(error instanceof Error ? error.message : String(error));
		}
	}, [doUpdate, profile.profileId]);

	const onSave = useMemo(() => methods.handleSubmit(submitValues), [methods, submitValues]);

	const onDiscard = useCallback(() => {
		setJsonError(null);
		reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	}, [initial, reset]);

	const onResetSessionId = useCallback(() => {
		setValue('operationProfileSessionId', uuidv4(), { shouldDirty: true });
	}, [setValue]);

	const toolbarState = useMemo<OperationProfileToolbarState>(() => {
		return {
			canSave: formState.isDirty,
			canDiscard: formState.isDirty,
			onSave,
			onDiscard,
			onResetSessionId,
		};
	}, [formState.isDirty, onDiscard, onResetSessionId, onSave]);

	useEffect(() => {
		onToolbarStateChange?.(toolbarState);
	}, [onToolbarStateChange, toolbarState]);

	useEffect(() => {
		return () => {
			onToolbarStateChange?.(null);
		};
	}, [onToolbarStateChange]);

	const addOperation = () => {
		const next = makeDefaultOperation();
		append(next);
		setEditingOpId(next.opId);
	};

	const moveSelection = (direction: 'prev' | 'next') => {
		if (items.length === 0) return;
		const current = selectedOpId ? items.findIndex((item) => item.opId === selectedOpId) : 0;
		const safeCurrent = current >= 0 ? current : 0;
		const nextIndex = direction === 'prev' ? Math.max(0, safeCurrent - 1) : Math.min(items.length - 1, safeCurrent + 1);
		const next = items[nextIndex];
		if (!next) return;
		setEditingOpId(next.opId);
	};

	const removeOperationAt = (targetIndex: number, targetOpId: string) => {
		if (!window.confirm(t('operationProfiles.confirm.deleteOperation'))) return;
		const currentPosition = items.findIndex((item) => item.opId === targetOpId);
		const next =
			items[currentPosition + 1]?.opId ??
			items[currentPosition - 1]?.opId ??
			null;
		remove(targetIndex);
		setEditingOpId(next);
	};

	const renderOperationEditor = (item: OperationListItemVm) => (
		<OperationEditor
			index={item.index}
			title={item.name}
			status={{
				index: item.index + 1,
				kind: item.kind,
				isDirty: formState.isDirty,
			}}
			onRemove={() => removeOperationAt(item.index, item.opId)}
		/>
	);

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Card withBorder className="op-editorCard">
					<Group
						justify="space-between"
						align="center"
						wrap="nowrap"
						className="op-sectionToggle"
						onClick={() => setIsProfileOpen((v) => !v)}
					>
						<Group gap="xs" wrap="nowrap">
							{isProfileOpen ? <LuChevronDown /> : <LuChevronUp />}
							<Text fw={700}>{t('operationProfiles.profileSettings.title')}</Text>
						</Group>
					</Group>

					<Collapse in={isProfileOpen}>
						<Stack gap="xs" pt="md">
							<FormInput name="name" label={t('operationProfiles.profileSettings.profileName')} inputProps={{ style: { flex: 1 } }} />
							<FormInput name="description" label={t('operationProfiles.sectionsLabels.description')} />

							<Group gap="md" wrap="wrap">
								<FormSwitch name="enabled" label={t('operationProfiles.profileSettings.profileEnabled')} />
								<FormSelect
									name="executionMode"
									label={t('operationProfiles.profileSettings.executionMode')}
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
								label={t('operationProfiles.profileSettings.sessionId')}
								infoTip={t('operationProfiles.profileSettings.sessionIdInfo')}
							/>
						</Stack>
					</Collapse>
				</Card>

				{jsonError && (
					<Alert color="red" title={t('operationProfiles.profileSettings.invalidJson')}>
						{jsonError}
					</Alert>
				)}

				{items.length === 0 ? (
					<Card withBorder className="op-editorCard">
						<Stack align="flex-start" gap="sm">
							<Text fw={700}>{t('operationProfiles.operations.title')}</Text>
							<Text size="sm" c="dimmed">
								{t('operationProfiles.operations.empty')}
							</Text>
							<Button leftSection={<LuPlus />} onClick={addOperation}>
								{t('operationProfiles.actions.addOperation')}
							</Button>
						</Stack>
					</Card>
				) : useSplitLayout ? (
					<div className="op-workspace">
						<div className="op-listPane">
							<OperationList
								items={items}
								selectedOpId={selectedOpId}
								stats={stats}
								onQuickAdd={addOperation}
								onMoveSelection={moveSelection}
								onSelect={(opId) => setEditingOpId(opId)}
							/>
						</div>

						<div className="op-inspectorPane">
							<div className="op-editorHeader op-stickyHeader op-inspectorHeader">
								<Stack gap={2}>
									<Text fw={700}>{t('operationProfiles.inspector.title')}</Text>
									<Text className="op-listHint">
										{selectedIndex === null ? t('operationProfiles.inspector.noneSelected') : t('operationProfiles.inspector.operationNumber', { number: selectedIndex + 1 })}
									</Text>
								</Stack>
							</div>

							{selectedItem ? (
								renderOperationEditor(selectedItem)
							) : (
								<Text size="sm" c="dimmed">
									{t('operationProfiles.inspector.selectFromList')}
								</Text>
							)}
						</div>
					</div>
				) : (
					<Card withBorder className="op-editorCard">
						<OperationList
							items={items}
							selectedOpId={selectedOpId}
							stats={stats}
							onQuickAdd={addOperation}
							onMoveSelection={moveSelection}
							onSelect={(opId) => setEditingOpId(opId)}
							renderInlineEditor={renderOperationEditor}
						/>
					</Card>
				)}
			</Stack>
		</FormProvider>
	);
};
