import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuSearch } from 'react-icons/lu';

import { OperationRowContainer } from './operation-row-container';

import type { OperationFilterState, OperationListRowMeta } from './types';
import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	rows: OperationListRowMeta[];
	selectedOpId: string | null;
	onSelect: (opId: string) => void;
	onQuickAdd: () => void;
	onMoveSelection: (direction: 'prev' | 'next') => void;
	onFocusEditor?: () => void;
};

const DEFAULT_FILTERS: OperationFilterState = {
	query: '',
	kind: 'all',
	enabled: 'all',
	required: 'all',
};

type OperationRowFilterSnapshot = OperationListRowMeta & {
	name: string;
	kind: OperationKind;
	enabled: boolean;
	required: boolean;
	depsCount: number;
};

const ROW_WATCH_STRIDE = 5;
const VIRTUALIZATION_THRESHOLD = 25;
const ROW_ESTIMATED_HEIGHT = 82;

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

function matchesEnabledFilter(item: OperationRowFilterSnapshot, filter: OperationFilterState['enabled']): boolean {
	if (filter === 'all') return true;
	if (filter === 'enabled') return item.enabled;
	return !item.enabled;
}

function matchesRequiredFilter(item: OperationRowFilterSnapshot, filter: OperationFilterState['required']): boolean {
	if (filter === 'all') return true;
	if (filter === 'required') return item.required;
	return !item.required;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName.toLowerCase();
	return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export const OperationList: React.FC<Props> = ({
	rows,
	selectedOpId,
	onSelect,
	onQuickAdd,
	onMoveSelection,
	onFocusEditor,
}) => {
	const { t } = useTranslation();
	const { control } = useFormContext();
	const [filters, setFilters] = useState<OperationFilterState>(DEFAULT_FILTERS);
	const [debouncedQuery] = useDebouncedValue(filters.query.trim().toLowerCase(), 180);
	const scrollRef = useRef<HTMLDivElement | null>(null);

	const filterWatchPaths = useMemo(
		() =>
			rows.flatMap((row) => [
				`operations.${row.index}.name`,
				`operations.${row.index}.kind`,
				`operations.${row.index}.config.enabled`,
				`operations.${row.index}.config.required`,
				`operations.${row.index}.config.dependsOn`,
			]),
		[rows],
	);

	const filterWatchValues = useWatch({ control, name: filterWatchPaths }) as unknown[] | undefined;

	const rowFilterSnapshots = useMemo<OperationRowFilterSnapshot[]>(() => {
		if (rows.length === 0) return [];
		return rows.map((row, rowPosition) => {
			const base = rowPosition * ROW_WATCH_STRIDE;
			const nameValue = filterWatchValues?.[base];
			const kindValue = filterWatchValues?.[base + 1];
			const enabledValue = filterWatchValues?.[base + 2];
			const requiredValue = filterWatchValues?.[base + 3];
			const dependsOnValue = filterWatchValues?.[base + 4];

			return {
				...row,
				name:
					typeof nameValue === 'string' && nameValue.trim().length > 0
						? nameValue.trim()
						: t('operationProfiles.defaults.untitledOperation'),
				kind: isOperationKind(kindValue) ? kindValue : 'template',
				enabled: Boolean(enabledValue),
				required: Boolean(requiredValue),
				depsCount: Array.isArray(dependsOnValue) ? dependsOnValue.length : 0,
			};
		});
	}, [filterWatchValues, rows, t]);

	const kindOptions = useMemo(() => {
		const set = new Set(rowFilterSnapshots.map((item) => item.kind));
		return [{ value: 'all', label: t('operationProfiles.filters.allKinds') }, ...Array.from(set).sort().map((value) => ({ value, label: value }))];
	}, [rowFilterSnapshots, t]);

	const filteredRows = useMemo(() => {
		return rowFilterSnapshots.filter((item) => {
			if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
			if (!matchesEnabledFilter(item, filters.enabled)) return false;
			if (!matchesRequiredFilter(item, filters.required)) return false;

			if (!debouncedQuery) return true;
			const haystack = `${item.name}\n${item.opId}\n${item.kind}\n${item.enabled ? 'enabled' : 'disabled'}\n${item.required ? 'required' : 'optional'}\n${item.depsCount}`.toLowerCase();
			return haystack.includes(debouncedQuery);
		});
	}, [debouncedQuery, filters.enabled, filters.kind, filters.required, rowFilterSnapshots]);

	const shouldVirtualize = filteredRows.length >= VIRTUALIZATION_THRESHOLD;

	const virtualizer = useVirtualizer({
		count: shouldVirtualize ? filteredRows.length : 0,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ROW_ESTIMATED_HEIGHT,
		overscan: 8,
	});

	const selectedFilteredIndex = useMemo(() => {
		if (!selectedOpId) return -1;
		return filteredRows.findIndex((row) => row.opId === selectedOpId);
	}, [filteredRows, selectedOpId]);

	useEffect(() => {
		if (!shouldVirtualize) return;
		if (selectedFilteredIndex < 0) return;
		virtualizer.scrollToIndex(selectedFilteredIndex, { align: 'auto' });
	}, [selectedFilteredIndex, shouldVirtualize, virtualizer]);

	return (
		<Stack
			gap="xs"
			role="listbox"
			tabIndex={0}
			className="op-focusRing"
			onKeyDown={(event) => {
				if (isTextEditingTarget(event.target)) return;
				if (event.key === 'ArrowUp') {
					event.preventDefault();
					onMoveSelection('prev');
				}
				if (event.key === 'ArrowDown') {
					event.preventDefault();
					onMoveSelection('next');
				}
				if (event.key === 'Enter') {
					event.preventDefault();
					onFocusEditor?.();
				}
			}}
		>
			<div className="op-listHeader">
				<Group justify="space-between" align="center" wrap="nowrap">
					<Stack gap={2}>
						<Text fw={700}>{t('operationProfiles.operations.title')}</Text>
						<Text className="op-listHint">
							{t('operationProfiles.operations.visibleOfTotal', { visible: filteredRows.length, total: rows.length })}
						</Text>
					</Stack>

					<Button size="xs" leftSection={<LuPlus />} onClick={onQuickAdd}>
						{t('common.add')}
					</Button>
				</Group>
			</div>

			<TextInput
				value={filters.query}
				onChange={(event) => setFilters((prev) => ({ ...prev, query: event.currentTarget.value }))}
				placeholder={t('operationProfiles.filters.searchPlaceholder')}
				leftSection={<LuSearch />}
				aria-label={t('operationProfiles.filters.searchAria')}
			/>

			<Group grow wrap="wrap">
				<Select
					data={kindOptions}
					value={filters.kind}
					onChange={(next) =>
						setFilters((prev) => ({
							...prev,
							kind: next === 'all' || next === null ? 'all' : (next as OperationFilterState['kind']),
						}))
					}
					comboboxProps={{ withinPortal: false }}
					aria-label={t('operationProfiles.filters.byKindAria')}
				/>
				<Select
					data={[
						{ value: 'all', label: t('operationProfiles.filters.allStates') },
						{ value: 'enabled', label: t('operationProfiles.filters.enabledOnly') },
						{ value: 'disabled', label: t('operationProfiles.filters.disabledOnly') },
					]}
					value={filters.enabled}
					onChange={(next) =>
						setFilters((prev) => ({
							...prev,
							enabled:
								next === 'enabled' || next === 'disabled' || next === 'all'
									? next
									: DEFAULT_FILTERS.enabled,
						}))
					}
					comboboxProps={{ withinPortal: false }}
					aria-label={t('operationProfiles.filters.byEnabledAria')}
				/>
				<Select
					data={[
						{ value: 'all', label: t('operationProfiles.filters.allRequiredStates') },
						{ value: 'required', label: t('operationProfiles.filters.requiredOnly') },
						{ value: 'optional', label: t('operationProfiles.filters.optionalOnly') },
					]}
					value={filters.required}
					onChange={(next) =>
						setFilters((prev) => ({
							...prev,
							required:
								next === 'required' || next === 'optional' || next === 'all'
									? next
									: DEFAULT_FILTERS.required,
						}))
					}
					comboboxProps={{ withinPortal: false }}
					aria-label={t('operationProfiles.filters.byRequiredAria')}
				/>
			</Group>

			{filteredRows.length === 0 ? (
				<Text size="sm" c="dimmed">
					{t('operationProfiles.filters.noMatches')}
				</Text>
			) : shouldVirtualize ? (
				<div ref={scrollRef} className="op-listScrollArea">
					<div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const row = filteredRows[virtualRow.index];
							if (!row) return null;
							return (
								<div
									key={row.rowKey}
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										width: '100%',
										transform: `translateY(${virtualRow.start}px)`,
										paddingBottom: 8,
									}}
								>
									<OperationRowContainer
										index={row.index}
										opId={row.opId}
										selected={selectedOpId === row.opId}
										onSelect={onSelect}
									/>
								</div>
							);
						})}
					</div>
				</div>
			) : (
				filteredRows.map((row) => (
					<OperationRowContainer
						key={row.rowKey}
						index={row.index}
						opId={row.opId}
						selected={selectedOpId === row.opId}
						onSelect={onSelect}
					/>
				))
			)}
		</Stack>
	);
};
