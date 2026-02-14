import { Alert, Button, Card, Collapse, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuPlus } from 'react-icons/lu';

import { updateOperationBlockFx } from '@model/operation-blocks';
import { FormInput, FormSwitch } from '@ui/form-components';

import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from './form/operation-profile-form-mapping';
import { OperationEditor } from './ui/operation-editor/operation-editor';
import { OperationList } from './ui/operation-list';

import type { OperationListRowMeta } from './ui/types';
import type { OperationBlockDto, OperationProfileDto } from '../../../api/chat-core';
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
	block: OperationBlockDto;
	preferSplitLayout: boolean;
	onToolbarStateChange?: (state: OperationBlockToolbarState | null) => void;
};

export type OperationBlockToolbarState = {
	canSave: boolean;
	canDiscard: boolean;
	onSave: () => void;
	onDiscard: () => void;
};

type SelectedOperationEditorProps = {
	index: number;
	opId: string;
	isDirty: boolean;
	onRemove: (index: number, opId: string) => void;
};

const SelectedOperationEditor: React.FC<SelectedOperationEditorProps> = React.memo(({ index, opId, isDirty, onRemove }) => {
	const { t } = useTranslation();
	const [nameValue, kindValue] = useWatch({
		name: [`operations.${index}.name`, `operations.${index}.kind`],
	}) as [unknown, unknown];

	const normalizedKind: OperationKind = isOperationKind(kindValue) ? kindValue : 'template';
	const title =
		typeof nameValue === 'string' && nameValue.trim().length > 0
			? nameValue.trim()
			: t('operationProfiles.defaults.untitledOperation');

	return (
		<OperationEditor
			index={index}
			title={title}
			status={{
				index: index + 1,
				kind: normalizedKind,
				isDirty,
			}}
			onRemove={() => onRemove(index, opId)}
		/>
	);
});

SelectedOperationEditor.displayName = 'SelectedOperationEditor';

export const OperationBlockEditor: React.FC<Props> = ({ block, preferSplitLayout, onToolbarStateChange }) => {
	const { t } = useTranslation();
	const doUpdate = useUnit(updateOperationBlockFx);
	const isMobile = useMediaQuery('(max-width: 767px)');
	const useSplitLayout = preferSplitLayout && !isMobile;

	const initial = useMemo(
		() =>
			toOperationProfileForm({
				profileId: block.blockId,
				ownerId: block.ownerId,
				name: block.name,
				description: block.description,
				enabled: block.enabled,
				executionMode: 'sequential',
				operationProfileSessionId: '00000000-0000-0000-0000-000000000000',
				blockRefs: [],
				operations: block.operations,
				meta: block.meta,
				version: block.version,
				createdAt: block.createdAt,
				updatedAt: block.updatedAt,
			} satisfies OperationProfileDto),
		[block],
	);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, formState, reset } = methods;

	const { fields, append, remove } = useFieldArray({
		name: 'operations',
		control,
		keyName: '_key',
	});

	const rows = useMemo<OperationListRowMeta[]>(() => {
		return fields
			.map((field, index): OperationListRowMeta | null => {
				if (typeof field.opId !== 'string' || field.opId.length === 0) return null;
				const rowKey = typeof field._key === 'string' && field._key.length > 0 ? field._key : `${field.opId}-${index}`;
				return {
					opId: field.opId,
					index,
					rowKey,
				};
			})
			.filter((row): row is OperationListRowMeta => row !== null);
	}, [fields]);

	const [isProfileOpen, setIsProfileOpen] = useState(true);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [editingOpId, setEditingOpId] = useState<string | null>(() => initial.operations[0]?.opId ?? null);

	useEffect(() => {
		setJsonError(null);
		reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	}, [initial, reset]);

	const selectedIndex = useMemo(() => {
		if (rows.length === 0) return null;
		if (editingOpId) {
			const match = rows.find((row) => row.opId === editingOpId);
			if (match) return match.index;
		}
		return rows[0]?.index ?? null;
	}, [editingOpId, rows]);

	const selectedRow = selectedIndex === null ? null : rows.find((row) => row.index === selectedIndex) ?? null;
	const selectedOpId = selectedRow?.opId ?? null;

	const submitValues = useCallback(
		(values: OperationProfileFormValues) => {
			setJsonError(null);
			try {
				const payload = fromOperationProfileForm(values, { validateJson: true });
				doUpdate({
					blockId: block.blockId,
					patch: {
						name: payload.name,
						description: payload.description,
						enabled: payload.enabled,
						operations: payload.operations,
					},
				});
			} catch (error) {
				setJsonError(error instanceof Error ? error.message : String(error));
			}
		},
		[doUpdate, block.blockId],
	);

	const onSave = useMemo(() => methods.handleSubmit(submitValues), [methods, submitValues]);

	const onDiscard = useCallback(() => {
		setJsonError(null);
		reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	}, [initial, reset]);

	const toolbarState = useMemo<OperationBlockToolbarState>(() => {
		return {
			canSave: formState.isDirty,
			canDiscard: formState.isDirty,
			onSave,
			onDiscard,
		};
	}, [formState.isDirty, onDiscard, onSave]);

	useEffect(() => {
		onToolbarStateChange?.(toolbarState);
	}, [onToolbarStateChange, toolbarState]);

	useEffect(() => {
		return () => {
			onToolbarStateChange?.(null);
		};
	}, [onToolbarStateChange]);

	const addOperation = useCallback(() => {
		const next = makeDefaultOperation();
		append(next);
		setEditingOpId(next.opId);
	}, [append]);

	const moveSelection = useCallback(
		(direction: 'prev' | 'next') => {
			if (rows.length === 0) return;
			const current = selectedOpId ? rows.findIndex((row) => row.opId === selectedOpId) : 0;
			const safeCurrent = current >= 0 ? current : 0;
			const nextIndex = direction === 'prev' ? Math.max(0, safeCurrent - 1) : Math.min(rows.length - 1, safeCurrent + 1);
			const next = rows[nextIndex];
			if (!next) return;
			setEditingOpId(next.opId);
		},
		[rows, selectedOpId],
	);

	const removeOperationAt = useCallback(
		(targetIndex: number, targetOpId: string) => {
			if (!window.confirm(t('operationProfiles.confirm.deleteOperation'))) return;
			const currentPosition = rows.findIndex((row) => row.opId === targetOpId);
			if (currentPosition < 0) {
				remove(targetIndex);
				setEditingOpId(rows[0]?.opId ?? null);
				return;
			}
			const next = rows[currentPosition + 1]?.opId ?? rows[currentPosition - 1]?.opId ?? null;
			remove(targetIndex);
			setEditingOpId(next);
		},
		[remove, rows, t],
	);

	const inspectorContent = selectedRow ? (
		<SelectedOperationEditor
			key={selectedRow.opId}
			index={selectedRow.index}
			opId={selectedRow.opId}
			isDirty={formState.isDirty}
			onRemove={removeOperationAt}
		/>
	) : (
		<Text size="sm" c="dimmed">
			{t('operationProfiles.inspector.selectFromList')}
		</Text>
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
							<Text fw={700}>{t('operationProfiles.blocks.blockSettingsTitle')}</Text>
						</Group>
					</Group>

					<Collapse in={isProfileOpen}>
						<Stack gap="xs" pt="md">
							<FormInput name="name" label={t('operationProfiles.blocks.blockName')} inputProps={{ style: { flex: 1 } }} />
							<FormInput name="description" label={t('operationProfiles.sectionsLabels.description')} />

							<Group gap="md" wrap="wrap">
								<FormSwitch name="enabled" label={t('operationProfiles.blocks.blockEnabled')} />
							</Group>
						</Stack>
					</Collapse>
				</Card>

				{jsonError && (
					<Alert color="red" title={t('operationProfiles.profileSettings.invalidJson')}>
						{jsonError}
					</Alert>
				)}

				{rows.length === 0 ? (
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
								rows={rows}
								selectedOpId={selectedOpId}
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

							{inspectorContent}
						</div>
					</div>
				) : (
					<>
						<Card withBorder className="op-editorCard">
							<OperationList
								rows={rows}
								selectedOpId={selectedOpId}
								onQuickAdd={addOperation}
								onMoveSelection={moveSelection}
								onSelect={(opId) => setEditingOpId(opId)}
							/>
						</Card>
						<Card withBorder className="op-editorCard">{inspectorContent}</Card>
					</>
				)}
			</Stack>
		</FormProvider>
	);
};
