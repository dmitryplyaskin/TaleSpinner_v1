import { Box, Button, Collapse, Group, Pagination, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuSlidersHorizontal } from 'react-icons/lu';

import { createEmptyUserPerson, userPersonsModel } from '@model/user-persons';
import { Dialog } from '@ui/dialog';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { BASE_URL } from '../../../const';

import { UserPersonCard } from './user-person-card';
import { UserPersonEditor } from './user-person-editor';

type SortType = 'A-Z' | 'Z-A' | 'newest' | 'oldest' | 'latest';
type UserPersonsUiState = {
	searchValue: string;
	sortType: SortType;
	advancedFiltersOpen: boolean;
	pageSize: number;
};

const USER_PERSONS_UI_STATE_STORAGE_KEY = 'user_persons_ui_state_v1';
const DEFAULT_PAGE_SIZE = 10;
const VALID_PAGE_SIZES = new Set([5, 10, 25, 50]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSortType(value: unknown): value is SortType {
	return value === 'A-Z' || value === 'Z-A' || value === 'newest' || value === 'oldest' || value === 'latest';
}

function getDefaultUiState(): UserPersonsUiState {
	return {
		searchValue: '',
		sortType: 'latest',
		advancedFiltersOpen: false,
		pageSize: DEFAULT_PAGE_SIZE,
	};
}

function loadUiState(): UserPersonsUiState {
	const defaults = getDefaultUiState();
	if (typeof window === 'undefined') return defaults;
	try {
		const raw = window.localStorage.getItem(USER_PERSONS_UI_STATE_STORAGE_KEY);
		if (!raw) return defaults;
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) return defaults;

		return {
			searchValue: typeof parsed.searchValue === 'string' ? parsed.searchValue : defaults.searchValue,
			sortType: isSortType(parsed.sortType) ? parsed.sortType : defaults.sortType,
			advancedFiltersOpen: typeof parsed.advancedFiltersOpen === 'boolean' ? parsed.advancedFiltersOpen : defaults.advancedFiltersOpen,
			pageSize: typeof parsed.pageSize === 'number' && VALID_PAGE_SIZES.has(parsed.pageSize) ? parsed.pageSize : defaults.pageSize,
		};
	} catch {
		return defaults;
	}
}

function saveUiState(state: UserPersonsUiState): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(USER_PERSONS_UI_STATE_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// ignore storage access errors
	}
}

function getPersonSearchText(person: UserPersonType): string {
	return [person.name, person.prefix, person.contentTypeDefault].filter(Boolean).join(' ').toLowerCase();
}

async function safeReadJson(response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : {};
	} catch {
		return {};
	}
}

export const UserPersonSidebar: React.FC = () => {
	const { t } = useTranslation();
	const initialUiStateRef = useRef<UserPersonsUiState | null>(null);
	if (!initialUiStateRef.current) {
		initialUiStateRef.current = loadUiState();
	}
	const initialUiState = initialUiStateRef.current;

	const [items, settings] = useUnit([userPersonsModel.$items, userPersonsModel.$settings]);
	const [searchValue, setSearchValue] = useState(initialUiState.searchValue);
	const [sortType, setSortType] = useState<SortType>(initialUiState.sortType);
	const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(initialUiState.advancedFiltersOpen);
	const [pageSize, setPageSize] = useState(initialUiState.pageSize);
	const [currentPage, setCurrentPage] = useState(1);
	const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
	const [deletingPerson, setDeletingPerson] = useState<UserPersonType | null>(null);

	const sortOptions = useMemo(
		() => [
			{ value: 'A-Z', label: t('sortFilter.sort.alphaAsc') },
			{ value: 'Z-A', label: t('sortFilter.sort.alphaDesc') },
			{ value: 'newest', label: t('sortFilter.sort.newest') },
			{ value: 'oldest', label: t('sortFilter.sort.oldest') },
			{ value: 'latest', label: t('sortFilter.sort.latest') },
		],
		[t],
	);

	const filteredAndSorted = useMemo(() => {
		const search = searchValue.trim().toLowerCase();
		const filtered = items.filter((item) => {
			if (search.length === 0) return true;
			return getPersonSearchText(item).includes(search);
		});

		return filtered.sort((a, b) => {
			switch (sortType) {
				case 'A-Z':
					return a.name.localeCompare(b.name);
				case 'Z-A':
					return b.name.localeCompare(a.name);
				case 'newest':
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
				case 'oldest':
					return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
				case 'latest':
				default:
					return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
			}
		});
	}, [items, searchValue, sortType]);

	const totalItems = filteredAndSorted.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

	useEffect(() => {
		setCurrentPage(1);
	}, [searchValue, sortType, pageSize]);

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	useEffect(() => {
		saveUiState({
			searchValue,
			sortType,
			advancedFiltersOpen,
			pageSize,
		});
	}, [advancedFiltersOpen, pageSize, searchValue, sortType]);

	const paginated = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredAndSorted.slice(start, start + pageSize);
	}, [currentPage, filteredAndSorted, pageSize]);

	const editingPerson = useMemo(() => {
		if (!editingPersonId) return null;
		return items.find((person) => person.id === editingPersonId) ?? null;
	}, [editingPersonId, items]);

	const handleDeleteConfirm = async () => {
		if (!deletingPerson) return;
		try {
			const response = await fetch(`${BASE_URL}/user-persons/${encodeURIComponent(deletingPerson.id)}`, {
				method: 'DELETE',
			});
			if (!response.ok) {
				const json = (await safeReadJson(response)) as { error?: { message?: string } };
				throw new Error(json?.error?.message ?? `HTTP error ${response.status}`);
			}
			if (settings?.selectedId === deletingPerson.id) {
				await userPersonsModel.updateSettingsFx({ selectedId: null });
			}
			await userPersonsModel.getItemsFx();
			setDeletingPerson(null);
		} catch (error) {
			toaster.error({
				title: t('userPersons.toasts.deleteError'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return (
		<>
			<Drawer name="userPersons" title={t('sidebars.userPersonsTitle')}>
				<Stack gap="md">
					<Group justify="space-between" align="center" wrap="nowrap" className="ts-sidebar-toolbar">
						<Button
							onClick={() => userPersonsModel.createItemFx(createEmptyUserPerson())}
							leftSection={<LuPlus />}
							color="cyan"
						>
							{t('sidebars.addPerson')}
						</Button>
						<Switch
							label={t('common.enabled')}
							checked={Boolean(settings?.enabled)}
							onChange={(e) => userPersonsModel.updateSettingsFx({ enabled: e.currentTarget.checked })}
						/>
					</Group>

					<TextInput
						placeholder={t('userPersons.placeholders.searchByName')}
						value={searchValue}
						onChange={(e) => setSearchValue(e.currentTarget.value)}
					/>

					<Group align="flex-end" justify="space-between" wrap="nowrap">
						<IconButtonWithTooltip
							icon={<LuSlidersHorizontal />}
							tooltip={
								advancedFiltersOpen
									? t('userPersons.filters.hideAdvancedTooltip')
									: t('userPersons.filters.showAdvancedTooltip')
							}
							aria-label={
								advancedFiltersOpen
									? t('userPersons.filters.hideAdvancedTooltip')
									: t('userPersons.filters.showAdvancedTooltip')
							}
							variant="outline"
							size="lg"
							onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
						/>
					</Group>

					<Collapse in={advancedFiltersOpen}>
						<Group align="flex-end" grow>
							<Select
								label={t('userPersons.filters.sortLabel')}
								data={sortOptions}
								value={sortType}
								onChange={(next) => setSortType((next as SortType | null) ?? 'latest')}
								comboboxProps={{ withinPortal: false }}
							/>
							<Select
								label={t('userPersons.filters.pageSizeLabel')}
								value={String(pageSize)}
								onChange={(value) => setPageSize(Number(value ?? DEFAULT_PAGE_SIZE))}
								data={[
									{ value: '5', label: '5' },
									{ value: '10', label: '10' },
									{ value: '25', label: '25' },
									{ value: '50', label: '50' },
								]}
								comboboxProps={{ withinPortal: false }}
							/>
						</Group>
					</Collapse>

					<Group align="center" wrap="nowrap">
						{totalItems > pageSize ? (
							<Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} withEdges />
						) : (
							<Box />
						)}
						<Text size="sm" c="dimmed" style={{ marginLeft: 'auto' }}>
							{t('userPersons.pagination.shownOfTotal', { shown: paginated.length, total: totalItems })}
						</Text>
					</Group>

					{paginated.length > 0 ? (
						<Stack gap="md">
							{paginated.map((person) => (
								<UserPersonCard
									key={person.id}
									data={person}
									isActive={settings?.selectedId === person.id}
									onSelect={(selectedPerson) => userPersonsModel.updateSettingsFx({ selectedId: selectedPerson.id })}
									onEdit={(selectedPerson) => setEditingPersonId(selectedPerson.id)}
									onDelete={setDeletingPerson}
								/>
							))}
						</Stack>
					) : (
						<Box style={{ textAlign: 'center', padding: 16, color: 'var(--mantine-color-dimmed)' }}>
							{t('userPersons.empty.noMatches')}
						</Box>
					)}
				</Stack>
			</Drawer>

			<UserPersonEditor opened={Boolean(editingPerson)} data={editingPerson} onClose={() => setEditingPersonId(null)} />

			<Dialog
				open={Boolean(deletingPerson)}
				onOpenChange={(open) => {
					if (!open) setDeletingPerson(null);
				}}
				title={t('userPersons.confirm.deleteTitle')}
				size="sm"
				footer={
					<>
						<Button variant="subtle" onClick={() => setDeletingPerson(null)}>
							{t('common.cancel')}
						</Button>
						<Button color="red" onClick={handleDeleteConfirm}>
							{t('common.delete')}
						</Button>
					</>
				}
			>
				<Text>{t('userPersons.confirm.deleteBody', { name: deletingPerson?.name ?? '' })}</Text>
			</Dialog>
		</>
	);
};
