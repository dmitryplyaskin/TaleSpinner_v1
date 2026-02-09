import { Box, Button, Collapse, Group, MultiSelect, NumberInput, Pagination, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuSlidersHorizontal } from 'react-icons/lu';

import {
	$currentEntityProfile,
	$entityProfiles,
	$updateEntityProfilePendingId,
	createEntityProfileFx,
	deleteEntityProfileFx,
	updateEntityProfileFx,
	updateEntityProfileRequested,
} from '@model/chat-core';
import { Dialog } from '@ui/dialog';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { exportEntityProfileFile } from '../../../api/chat-core';

import { AgentCard } from './agent-card';
import { Upload } from './components/upload';
import { EntityProfileEditorModal } from './entity-profile-editor-modal';
import { estimateTokens, getSpecSearchText, parseSpec } from './spec-utils';


import type { EntityProfileDto } from '../../../api/chat-core';

type SortType = 'A-Z' | 'Z-A' | 'newest' | 'oldest' | 'latest' | 'favorites' | 'mostTokens' | 'fewestTokens';
type FavoriteFilterMode = 'all' | 'onlyFavorite' | 'onlyNonFavorite';

export const AgentCardsSidebar = () => {
	const { t } = useTranslation();
	const [list, currentProfile, updatePendingId, savePending, deletePending, requestUpdate, doUpdateProfile, doDeleteProfile] = useUnit([
		$entityProfiles,
		$currentEntityProfile,
		$updateEntityProfilePendingId,
		updateEntityProfileFx.pending,
		deleteEntityProfileFx.pending,
		updateEntityProfileRequested,
		updateEntityProfileFx,
		deleteEntityProfileFx,
	]);

	const [searchValue, setSearchValue] = useState('');
	const [sortType, setSortType] = useState<SortType>('latest');
	const [favoriteMode, setFavoriteMode] = useState<FavoriteFilterMode>('all');
	const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [tokenMin, setTokenMin] = useState<number | ''>('');
	const [tokenMax, setTokenMax] = useState<number | ''>('');
	const [pageSize, setPageSize] = useState(10);
	const [currentPage, setCurrentPage] = useState(1);
	const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
	const [profileToDelete, setProfileToDelete] = useState<EntityProfileDto | null>(null);
	const [exportPending, setExportPending] = useState(false);

	const sortOptions = useMemo(
		() => [
			{ value: 'A-Z', label: t('sortFilter.sort.alphaAsc') },
			{ value: 'Z-A', label: t('sortFilter.sort.alphaDesc') },
			{ value: 'newest', label: t('sortFilter.sort.newest') },
			{ value: 'oldest', label: t('sortFilter.sort.oldest') },
			{ value: 'latest', label: t('sortFilter.sort.latest') },
			{ value: 'favorites', label: t('sortFilter.sort.favorites') },
			{ value: 'mostTokens', label: t('sortFilter.sort.mostTokens') },
			{ value: 'fewestTokens', label: t('sortFilter.sort.fewestTokens') },
		],
		[t],
	);

	const profilesView = useMemo(() => {
		return list.map((profile) => {
			const parsedSpec = parseSpec(profile.spec);
			const tokens = estimateTokens(parsedSpec);
			return {
				profile,
				parsedSpec,
				tokens,
				searchText: getSpecSearchText(parsedSpec),
			};
		});
	}, [list]);

	const tagOptions = useMemo(() => {
		const tags = new Set<string>();
		profilesView.forEach((item) => {
			item.parsedSpec.tags.forEach((tag) => {
				if (tag.trim().length > 0) tags.add(tag);
			});
		});
		return Array.from(tags).sort((a, b) => a.localeCompare(b)).map((tag) => ({ value: tag, label: tag }));
	}, [profilesView]);

	const filteredAndSorted = useMemo(() => {
		const search = searchValue.trim().toLowerCase();
		const filtered = profilesView.filter((item) => {
			if (favoriteMode === 'onlyFavorite' && !item.profile.isFavorite) return false;
			if (favoriteMode === 'onlyNonFavorite' && item.profile.isFavorite) return false;
			if (selectedTags.length > 0 && !item.parsedSpec.tags.some((tag) => selectedTags.includes(tag))) return false;
			if (tokenMin !== '' && item.tokens < tokenMin) return false;
			if (tokenMax !== '' && item.tokens > tokenMax) return false;
			if (search.length > 0 && !item.searchText.includes(search) && !item.profile.name.toLowerCase().includes(search)) return false;
			return true;
		});

		const sorted = filtered.slice().sort((a, b) => {
			switch (sortType) {
				case 'A-Z':
					return a.profile.name.localeCompare(b.profile.name);
				case 'Z-A':
					return b.profile.name.localeCompare(a.profile.name);
				case 'newest':
					return new Date(b.profile.createdAt).getTime() - new Date(a.profile.createdAt).getTime();
				case 'oldest':
					return new Date(a.profile.createdAt).getTime() - new Date(b.profile.createdAt).getTime();
				case 'favorites': {
					const favDiff = Number(b.profile.isFavorite) - Number(a.profile.isFavorite);
					if (favDiff !== 0) return favDiff;
					return new Date(b.profile.updatedAt).getTime() - new Date(a.profile.updatedAt).getTime();
				}
				case 'mostTokens':
					return b.tokens - a.tokens;
				case 'fewestTokens':
					return a.tokens - b.tokens;
				case 'latest':
				default:
					return new Date(b.profile.updatedAt).getTime() - new Date(a.profile.updatedAt).getTime();
			}
		});

		return sorted;
	}, [favoriteMode, profilesView, searchValue, selectedTags, sortType, tokenMax, tokenMin]);

	const totalItems = filteredAndSorted.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

	useEffect(() => {
		setCurrentPage(1);
	}, [searchValue, sortType, favoriteMode, selectedTags, tokenMin, tokenMax, pageSize]);

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	const paginated = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredAndSorted.slice(start, start + pageSize);
	}, [currentPage, filteredAndSorted, pageSize]);
	const editingProfile = useMemo(
		() => (editingProfileId ? list.find((profile) => profile.id === editingProfileId) ?? null : null),
		[editingProfileId, list],
	);

	const handleDeleteConfirm = async () => {
		if (!profileToDelete) return;
		try {
			await doDeleteProfile({ id: profileToDelete.id });
			setProfileToDelete(null);
		} catch {
			// error toast handled in model
		}
	};

	const handleSaveProfile = async (payload: { id: string; name: string; spec: unknown }) => {
		try {
			await doUpdateProfile(payload);
			setEditingProfileId(null);
		} catch {
			// error toast handled in model
		}
	};

	const handleExportProfile = async (profile: EntityProfileDto, format: 'json' | 'png') => {
		try {
			setExportPending(true);
			const file = await exportEntityProfileFile({ id: profile.id, format, preferredName: profile.name });
			const url = URL.createObjectURL(file.blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = file.filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (error) {
			toaster.error({
				title: t('agentCards.toasts.exportFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setExportPending(false);
		}
	};

	return (
		<>
			<Drawer name="agentCards" title={t('sidebars.agentProfilesTitle')}>
				<Stack gap="md">
					<Group gap="md" className="ts-sidebar-toolbar">
						<Button
							onClick={() => createEntityProfileFx({ name: `New profile ${new Date().toLocaleTimeString()}` })}
							leftSection={<LuPlus />}
							color="cyan"
						>
							{t('sidebars.createProfile')}
						</Button>
						<Upload />
					</Group>

					<TextInput
						placeholder={t('agentCards.filters.searchPlaceholder')}
						value={searchValue}
						onChange={(e) => setSearchValue(e.currentTarget.value)}
					/>

					<Group gap="sm" align="flex-end" wrap="wrap">
						<Stack gap={6} style={{ flex: 1, minWidth: 280 }}>
							<Text size="xs" c="dimmed">
								{t('agentCards.filters.favoriteModeLabel')}
							</Text>
							<SegmentedControl
								fullWidth
								value={favoriteMode}
								onChange={(value) => setFavoriteMode(value as FavoriteFilterMode)}
								data={[
									{ value: 'all', label: t('agentCards.filters.favoriteModeAll') },
									{ value: 'onlyFavorite', label: t('agentCards.filters.favoriteModeOnly') },
									{ value: 'onlyNonFavorite', label: t('agentCards.filters.favoriteModeWithout') },
								]}
							/>
						</Stack>
						<IconButtonWithTooltip
							icon={<LuSlidersHorizontal />}
							tooltip={
								advancedFiltersOpen
									? t('agentCards.filters.hideAdvancedTooltip')
									: t('agentCards.filters.showAdvancedTooltip')
							}
							aria-label={
								advancedFiltersOpen
									? t('agentCards.filters.hideAdvancedTooltip')
									: t('agentCards.filters.showAdvancedTooltip')
							}
							variant="outline"
							size="lg"
							onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
						/>
					</Group>

					<Collapse in={advancedFiltersOpen}>
						<Stack gap="sm">
							<Group align="flex-end" grow>
								<Select
									label={t('agentCards.filters.sortLabel')}
									data={sortOptions}
									value={sortType}
									onChange={(next) => setSortType((next as SortType | null) ?? 'latest')}
									comboboxProps={{ withinPortal: false }}
								/>
								<MultiSelect
									label={t('agentCards.filters.tagsLabel')}
									data={tagOptions}
									value={selectedTags}
									onChange={setSelectedTags}
									placeholder={t('agentCards.filters.tagsPlaceholder')}
									comboboxProps={{ withinPortal: false }}
									clearable
									searchable
								/>
							</Group>

							<Group align="flex-end" grow>
								<NumberInput
									label={t('agentCards.filters.tokenMinLabel')}
									min={0}
									value={tokenMin}
									onChange={(value) => setTokenMin(typeof value === 'number' ? value : '')}
								/>
								<NumberInput
									label={t('agentCards.filters.tokenMaxLabel')}
									min={0}
									value={tokenMax}
									onChange={(value) => setTokenMax(typeof value === 'number' ? value : '')}
								/>
								<Select
									label={t('agentCards.filters.pageSizeLabel')}
									value={String(pageSize)}
									onChange={(value) => setPageSize(Number(value ?? 10))}
									data={[
										{ value: '5', label: '5' },
										{ value: '10', label: '10' },
										{ value: '25', label: '25' },
										{ value: '50', label: '50' },
									]}
									comboboxProps={{ withinPortal: false }}
								/>
							</Group>
						</Stack>
					</Collapse>

					<Group align="center" wrap="nowrap">
						{totalItems > pageSize ? (
							<Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} withEdges />
						) : (
							<Box />
						)}
						<Text size="sm" c="dimmed" style={{ marginLeft: 'auto' }}>
							{t('agentCards.pagination.shownOfTotal', { shown: paginated.length, total: totalItems })}
						</Text>
					</Group>

					{paginated.length > 0 ? (
						paginated.map((item) => (
							<AgentCard
								key={item.profile.id}
								data={item.profile}
								isActive={currentProfile?.id === item.profile.id}
								favoritePending={updatePendingId === item.profile.id}
								onEdit={(profile) => setEditingProfileId(profile.id)}
								onDelete={setProfileToDelete}
								onToggleFavorite={(profile) => requestUpdate({ id: profile.id, isFavorite: !profile.isFavorite })}
							/>
						))
					) : (
						<Text size="sm" c="dimmed">
							{t('agentCards.empty.noMatches')}
						</Text>
					)}

				</Stack>
			</Drawer>

			<EntityProfileEditorModal
				opened={Boolean(editingProfile)}
				profile={editingProfile}
				saving={savePending && updatePendingId === editingProfile?.id}
				updating={updatePendingId === editingProfile?.id}
				deleting={deletePending}
				exporting={exportPending}
				onClose={() => setEditingProfileId(null)}
				onSave={handleSaveProfile}
				onToggleFavorite={(profile) => requestUpdate({ id: profile.id, isFavorite: !profile.isFavorite })}
				onDelete={setProfileToDelete}
				onAvatarChange={(profile, avatarUrl) => requestUpdate({ id: profile.id, avatarAssetId: avatarUrl })}
				onAvatarRemove={(profile) => requestUpdate({ id: profile.id, avatarAssetId: null })}
				onExport={handleExportProfile}
			/>

			<Dialog
				open={Boolean(profileToDelete)}
				onOpenChange={(open) => {
					if (!open) setProfileToDelete(null);
				}}
				title={t('agentCards.confirm.deleteProfileTitle')}
				size="sm"
				footer={
					<>
						<Button variant="subtle" onClick={() => setProfileToDelete(null)}>
							{t('common.cancel')}
						</Button>
						<Button color="red" loading={deletePending} onClick={handleDeleteConfirm}>
							{t('common.delete')}
						</Button>
					</>
				}
			>
				<Text>{t('agentCards.confirm.deleteProfileBody', { name: profileToDelete?.name ?? '' })}</Text>
			</Dialog>
		</>
	);
};
