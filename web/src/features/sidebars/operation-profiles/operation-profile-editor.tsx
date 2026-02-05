import { Alert, Button, Card, Collapse, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { LuChevronDown, LuChevronUp, LuPlus, LuRotateCcw, LuSave, LuUndo2 } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import { updateOperationProfileFx } from '@model/operation-profiles';
import { FormInput, FormSelect, FormSwitch } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

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
};

export const OperationProfileEditor: React.FC<Props> = ({ profile, preferSplitLayout }) => {
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
					name: typeof watched?.name === 'string' && watched.name.trim() ? watched.name.trim() : 'Untitled operation',
					kind: isOperationKind(rawKind) ? rawKind : 'template',
					enabled: Boolean(watched?.config?.enabled),
					required: Boolean(watched?.config?.required),
					depsCount: Array.isArray(watched?.config?.dependsOn) ? watched.config.dependsOn.length : 0,
				};
			})
			.filter((item): item is OperationListItemVm => item !== null);
	}, [fields, watchedOperations]);

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

	const onSave = methods.handleSubmit((values) => {
		setJsonError(null);
		try {
			const payload = fromOperationProfileForm(values, { validateJson: true });
			doUpdate({ profileId: profile.profileId, patch: payload });
		} catch (error) {
			setJsonError(error instanceof Error ? error.message : String(error));
		}
	});

	const onDiscard = () => {
		setJsonError(null);
		reset(initial);
		setEditingOpId(initial.operations[0]?.opId ?? null);
	};

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
		if (!window.confirm('Delete selected operation?')) return;
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
			canSave={formState.isDirty}
			canDiscard={formState.isDirty}
			onSave={onSave}
			onDiscard={onDiscard}
			onRemove={() => removeOperationAt(item.index, item.opId)}
		/>
	);

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Card withBorder className="op-editorCard">
					<div className="op-editorHeader op-stickyHeader">
						<Stack gap={2}>
							<Text fw={800}>Profile controls</Text>
						</Stack>

						<Group gap="xs" wrap="nowrap">
							<Button leftSection={<LuSave />} disabled={!formState.isDirty} onClick={onSave}>
								Save
							</Button>
							<Button variant="default" leftSection={<LuUndo2 />} disabled={!formState.isDirty} onClick={onDiscard}>
								Discard
							</Button>
							<IconButtonWithTooltip
								aria-label="Reset operation profile session id"
								tooltip="Reset session id"
								icon={<LuRotateCcw />}
								variant="ghost"
								onClick={() => setValue('operationProfileSessionId', uuidv4(), { shouldDirty: true })}
							/>
						</Group>
					</div>

					<div className="op-statusStrip" aria-label="Operation stats">
						<div className="op-statusPill">Ops: {stats.total}</div>
						<div className="op-statusPill">Enabled: {stats.enabled}</div>
						<div className="op-statusPill">Required: {stats.required}</div>
						<div className="op-statusPill">With deps: {stats.withDeps}</div>
					</div>
				</Card>

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
							<Text fw={700}>Profile settings</Text>
						</Group>
					</Group>

					<Collapse in={isProfileOpen}>
						<Stack gap="xs" pt="md">
							<FormInput name="name" label="Profile name" inputProps={{ style: { flex: 1 } }} />
							<FormInput name="description" label="Description" />

							<Group gap="md" wrap="wrap">
								<FormSwitch name="enabled" label="Profile enabled" />
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
								label="Operation profile session id"
								infoTip="Reset this id when you need a fresh validation and change-grouping scope."
							/>
						</Stack>
					</Collapse>
				</Card>

				{jsonError && (
					<Alert color="red" title="Invalid JSON payload">
						{jsonError}
					</Alert>
				)}

				{items.length === 0 ? (
					<Card withBorder className="op-editorCard">
						<Stack align="flex-start" gap="sm">
							<Text fw={700}>Operations</Text>
							<Text size="sm" c="dimmed">
								No operations yet. Add one to start editing.
							</Text>
							<Button leftSection={<LuPlus />} onClick={addOperation}>
								Add operation
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
							<div className="op-editorHeader op-stickyHeader">
								<Stack gap={2}>
									<Text fw={700}>Operation inspector</Text>
									<Text className="op-listHint">
										{selectedIndex === null ? 'No operation selected' : `Operation #${selectedIndex + 1}`}
									</Text>
								</Stack>
							</div>

							{selectedItem ? (
								renderOperationEditor(selectedItem)
							) : (
								<Text size="sm" c="dimmed">
									Select an operation from the list to start editing.
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
