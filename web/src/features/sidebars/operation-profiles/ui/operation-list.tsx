import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import React, { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuSearch } from 'react-icons/lu';

import { OperationRow } from './operation-row';

import type { OperationFilterState, OperationListItemVm, OperationStatsVm } from './types';

type Props = {
	items: OperationListItemVm[];
	selectedOpId: string | null;
	stats: OperationStatsVm;
	onSelect: (opId: string) => void;
	onQuickAdd: () => void;
	onMoveSelection: (direction: 'prev' | 'next') => void;
	onFocusEditor?: () => void;
	renderInlineEditor?: (item: OperationListItemVm) => ReactNode;
};

const DEFAULT_FILTERS: OperationFilterState = {
	query: '',
	kind: 'all',
	enabled: 'all',
	required: 'all',
};

function matchesEnabledFilter(item: OperationListItemVm, filter: OperationFilterState['enabled']): boolean {
	if (filter === 'all') return true;
	if (filter === 'enabled') return item.enabled;
	return !item.enabled;
}

function matchesRequiredFilter(item: OperationListItemVm, filter: OperationFilterState['required']): boolean {
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
	items,
	selectedOpId,
	stats,
	onSelect,
	onQuickAdd,
	onMoveSelection,
	onFocusEditor,
	renderInlineEditor,
}) => {
	const { t } = useTranslation();
	const [filters, setFilters] = useState<OperationFilterState>(DEFAULT_FILTERS);
	const [debouncedQuery] = useDebouncedValue(filters.query.trim().toLowerCase(), 180);

	const kindOptions = useMemo(() => {
		const set = new Set(items.map((item) => item.kind));
		return [
			{ value: 'all', label: t('operationProfiles.filters.allKinds') },
			...Array.from(set).sort().map((value) => ({ value, label: value })),
		];
	}, [items, t]);

	const filteredItems = useMemo(() => {
		return items.filter((item) => {
			if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
			if (!matchesEnabledFilter(item, filters.enabled)) return false;
			if (!matchesRequiredFilter(item, filters.required)) return false;

			if (!debouncedQuery) return true;
			const haystack = `${item.name}\n${item.opId}\n${item.kind}`.toLowerCase();
			return haystack.includes(debouncedQuery);
		});
	}, [debouncedQuery, filters.enabled, filters.kind, filters.required, items]);

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
							{t('operationProfiles.operations.visibleOfTotal', { visible: filteredItems.length, total: stats.total })}
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

			{filteredItems.length === 0 ? (
				<Text size="sm" c="dimmed">
					{t('operationProfiles.filters.noMatches')}
				</Text>
			) : (
				filteredItems.map((item) => (
					<React.Fragment key={item.opId}>
						<OperationRow item={item} selected={selectedOpId === item.opId} onSelect={onSelect} />
						{selectedOpId === item.opId && renderInlineEditor && (
							<div className="op-inlineEditor">{renderInlineEditor(item)}</div>
						)}
					</React.Fragment>
				))
			)}
		</Stack>
	);
};
