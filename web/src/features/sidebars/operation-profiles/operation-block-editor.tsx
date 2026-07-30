import { Alert, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { updateOperationBlockFx } from '@model/operation-blocks';

import { toOperationBlockFormValues } from './form/operation-block-form-values';
import { fromOperationProfileForm, makeDefaultOperation, type OperationProfileFormValues } from './form/operation-profile-form-mapping';
import { OperationBlockNodeEditorModal } from './node-editor/block-node-editor-modal';
import { BlockSettingsPanel } from './ui/block-settings-panel';
import { OperationEditor } from './ui/operation-editor/operation-editor';
import { OperationWorkspace } from './ui/operation-workspace';
import {
	resolveOperationWorkspaceMode,
	shouldShowBlockSettings,
	type CompactOperationView,
} from './ui/operation-workspace-mode';
import { isOperationKind } from './utils/operation-kind';

import type { OperationListRowMeta } from './ui/types';
import type { OperationBlockDto } from '../../../api/chat-core';
import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	block: OperationBlockDto;
	preferSplitLayout: boolean;
	nodeEditorOpened?: boolean;
	onNodeEditorClose?: () => void;
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

function resolveEditingOperationId(preferredOpId: string | null, operations: OperationProfileFormValues['operations']): string | null {
	if (preferredOpId && operations.some((operation) => operation.opId === preferredOpId)) return preferredOpId;
	return operations[0]?.opId ?? null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function areDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		if (left.length !== right.length) return false;
		for (let index = 0; index < left.length; index += 1) {
			if (!areDeepEqual(left[index], right[index])) return false;
		}
		return true;
	}

	if (isPlainObject(left) || isPlainObject(right)) {
		if (!isPlainObject(left) || !isPlainObject(right)) return false;
		const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
		const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
		if (leftKeys.length !== rightKeys.length) return false;
		for (const key of leftKeys) {
			if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
			if (!areDeepEqual(left[key], right[key])) return false;
		}
		return true;
	}

	return false;
}

export const OperationBlockEditor: React.FC<Props> = ({
	block,
	preferSplitLayout,
	nodeEditorOpened = false,
	onNodeEditorClose,
	onToolbarStateChange,
}) => {
	const { t } = useTranslation();
	const doUpdate = useUnit(updateOperationBlockFx);
	const isCompactViewport = useMediaQuery('(max-width: 1023px)');
	const useSplitLayout = preferSplitLayout && !isCompactViewport;

	const initial = useMemo(() => toOperationBlockFormValues(block), [block]);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, reset } = methods;
	const watchedValues = useWatch({ control });
	const watchedOperations = useWatch({ control, name: 'operations' });

	const operationsFieldArray = useFieldArray({
		name: 'operations',
		control,
		keyName: '_key',
	});
	const { fields, append, remove } = operationsFieldArray;

	const rows = useMemo<OperationListRowMeta[]>(() => {
		const operations = Array.isArray(watchedOperations) ? watchedOperations : fields;
		return operations
			.map((operation, index): OperationListRowMeta | null => {
				if (typeof operation?.opId !== 'string' || operation.opId.length === 0) return null;
				const field = fields[index];
				const rowKey =
					typeof field?._key === 'string' && field._key.length > 0
						? field._key
						: `${operation.opId}-${index}`;
				return {
					opId: operation.opId,
					index,
					rowKey,
				};
			})
			.filter((row): row is OperationListRowMeta => row !== null);
	}, [fields, watchedOperations]);

	const [jsonError, setJsonError] = useState<string | null>(null);
	const [baselineValues, setBaselineValues] = useState<OperationProfileFormValues>(initial);
	const [editingOpId, setEditingOpId] = useState<string | null>(() => resolveEditingOperationId(null, initial.operations));
	const [compactView, setCompactView] = useState<CompactOperationView>('list');

	const hasUnsavedChanges = useMemo(() => {
		const current = (watchedValues as OperationProfileFormValues | undefined) ?? baselineValues;
		return !areDeepEqual(current, baselineValues);
	}, [baselineValues, watchedValues]);

	useEffect(() => {
		setJsonError(null);
		reset(initial);
		setBaselineValues(initial);
		setEditingOpId((prev) => resolveEditingOperationId(prev, initial.operations));
	}, [initial, reset]);

	useEffect(() => {
		setCompactView('list');
	}, [block.blockId]);

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
	const workspaceMode = resolveOperationWorkspaceMode({ useSplitLayout, compactView, selectedOpId });

	const saveBlockDraft = useCallback(
		async (values: OperationProfileFormValues, meta?: unknown) => {
			setJsonError(null);
			let payload: ReturnType<typeof fromOperationProfileForm>;
			try {
				payload = fromOperationProfileForm(values, { validateJson: true });
			} catch (error) {
				setJsonError(error instanceof Error ? error.message : String(error));
				throw error;
			}

			const updatedBlock = await doUpdate({
				blockId: block.blockId,
				patch: {
					name: payload.name,
					description: payload.description,
					enabled: payload.enabled,
					operations: payload.operations,
					...(typeof meta === 'undefined' ? {} : { meta }),
				},
			});
			const nextValues = toOperationBlockFormValues(updatedBlock);
			reset(nextValues);
			setBaselineValues(nextValues);
			setEditingOpId((prev) => resolveEditingOperationId(prev, nextValues.operations));
		},
		[doUpdate, block.blockId, reset],
	);

	const submitValues = useCallback(
		async (values: OperationProfileFormValues) => {
			try {
				await saveBlockDraft(values);
			} catch {
				// API errors are surfaced by model-level toasts.
			}
		},
		[saveBlockDraft],
	);

	const onSave = useMemo(() => methods.handleSubmit(submitValues), [methods, submitValues]);

	const onDiscard = useCallback(() => {
		setJsonError(null);
		reset(initial);
		setBaselineValues(initial);
		setEditingOpId((prev) => resolveEditingOperationId(prev, initial.operations));
	}, [initial, reset]);

	const toolbarState = useMemo<OperationBlockToolbarState>(() => {
		return {
			canSave: hasUnsavedChanges,
			canDiscard: hasUnsavedChanges,
			onSave,
			onDiscard,
		};
	}, [hasUnsavedChanges, onDiscard, onSave]);

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
		if (!useSplitLayout) setCompactView('inspector');
	}, [append, useSplitLayout]);

	const selectOperation = useCallback(
		(opId: string) => {
			setEditingOpId(opId);
			if (!useSplitLayout) setCompactView('inspector');
		},
		[useSplitLayout],
	);

	const moveSelection = (direction: 'prev' | 'next') => {
		if (rows.length === 0) return;
		const current = selectedOpId ? rows.findIndex((row) => row.opId === selectedOpId) : 0;
		const safeCurrent = current >= 0 ? current : 0;
		const nextIndex = direction === 'prev' ? Math.max(0, safeCurrent - 1) : Math.min(rows.length - 1, safeCurrent + 1);
		const next = rows[nextIndex];
		if (!next) return;
		setEditingOpId(next.opId);
	};

	const removeOperationAt = useCallback(
		(targetIndex: number, targetOpId: string) => {
			if (!window.confirm(t('operationProfiles.confirm.deleteOperation'))) return;
			const currentPosition = rows.findIndex((row) => row.opId === targetOpId);
			if (currentPosition < 0) {
				remove(targetIndex);
				setEditingOpId(rows[0]?.opId ?? null);
				if (rows.length <= 1) setCompactView('list');
				return;
			}
			const next = rows[currentPosition + 1]?.opId ?? rows[currentPosition - 1]?.opId ?? null;
			remove(targetIndex);
			setEditingOpId(next);
			if (!next) setCompactView('list');
		},
		[remove, rows, t],
	);

	const inspectorContent = selectedRow ? (
		<SelectedOperationEditor
			key={selectedRow.opId}
			index={selectedRow.index}
			opId={selectedRow.opId}
			isDirty={hasUnsavedChanges}
			onRemove={removeOperationAt}
		/>
	) : (
		<Text size="sm" c="dimmed">
			{t('operationProfiles.inspector.selectFromList')}
		</Text>
	);

	return (
		<FormProvider {...methods}>
			<div className={`op-blockEditorRoot op-blockEditorRoot--${workspaceMode}`}>
				{shouldShowBlockSettings(workspaceMode) && <BlockSettingsPanel operationCount={rows.length} />}
				{jsonError && (
					<Alert color="red" title={t('operationProfiles.profileSettings.invalidJson')}>
						{jsonError}
					</Alert>
				)}
				<OperationWorkspace
					mode={workspaceMode}
					rows={rows}
					selectedOpId={selectedOpId}
					selectedIndex={selectedIndex}
					inspectorContent={inspectorContent}
					onAdd={addOperation}
					onMoveSelection={moveSelection}
					onSelect={selectOperation}
					onBackToList={() => setCompactView('list')}
				/>
			</div>

			<OperationBlockNodeEditorModal
				opened={nodeEditorOpened}
				onClose={onNodeEditorClose ?? (() => undefined)}
				block={block}
				form={methods}
				operationsFieldArray={operationsFieldArray}
				initialValues={initial}
				onSaveDraft={saveBlockDraft}
			/>
		</FormProvider>
	);
};
