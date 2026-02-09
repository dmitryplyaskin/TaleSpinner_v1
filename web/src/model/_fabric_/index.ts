import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { combine, sample } from 'effector';

import { createItemsModel } from './items-model';
import { createPaginationModel } from './pagination-model';
import { createSettingsModel } from './setting-model';
import { createSortFilterModel, type SortOption, type FilterOption } from './sort-filter-model';
import { type Fabric } from './types';

export interface FabricSortFilter<ItemType> {
	defaultSortOptions?: SortOption<ItemType>[];
	defaultFilterOptions?: FilterOption<ItemType>[];
}

export const createModel = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>(
	fabric: Fabric<SettingsType, ItemType> & { sortFilter?: FabricSortFilter<ItemType> },
) => {
	const { getSettingsFx, updateSettingsFx, $settings } = createSettingsModel(fabric.settings, fabric.fabricName);
	const {
		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
		$items,
		changeItemDebounced,
		changeItem,
	} = createItemsModel(fabric.items, fabric.fabricName);

	const $selectedItem = combine($settings, $items, (settings, items) => {
		if (!settings) return null;
		return items.find((item) => item.id === settings.selectedId) || null;
	});

	// const pagination = createPaginationModel(
	// 	$items,
	// 	fabric.pagination?.defaultPageSize || 10,
	// 	updateSettingsFx,
	// 	getSettingsFx,
	// );

	const sortFilter = createSortFilterModel(
		$items,
		fabric.sortFilter?.defaultSortOptions || getDefaultSortOptions<ItemType>(),
		fabric.sortFilter?.defaultFilterOptions || [],
		updateSettingsFx,
		getSettingsFx,
	);

	sample({
		clock: [createItemFx.doneData, duplicateItemFx.doneData],
		fn: ({ data }) => ({ selectedId: data.id } as Partial<SettingsType>),
		target: updateSettingsFx,
	});

	sample({
		clock: [deleteItemFx.done],
		fn: () => ({ selectedId: null } as Partial<SettingsType>),
		target: updateSettingsFx,
	});

	const paginationWithSortFilter = createPaginationModel(
		sortFilter.$filteredAndSortedItems,
		fabric.pagination?.defaultPageSize || 10,
		updateSettingsFx,
		getSettingsFx,
	);

	return {
		$settings,
		$items,
		$selectedItem,

		getSettingsFx,
		updateSettingsFx,

		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
		changeItemDebounced,
		changeItem,

		// pagination,
		paginationWithSortFilter,

		sortFilter,
	};
};

function getDefaultSortOptions<ItemType extends CommonModelItemType>(): SortOption<ItemType>[] {
	return [
		{
			type: 'A-Z',
			label: 'sortFilter.sort.alphaAsc',
			targetValue: 'name',
			sortFunction: (a, b) => (a.name || '').localeCompare(b.name || ''),
		},
		{
			type: 'Z-A',
			label: 'sortFilter.sort.alphaDesc',
			targetValue: 'name',
			sortFunction: (a, b) => (b.name || '').localeCompare(a.name || ''),
		},
		{
			type: 'newest',
			label: 'sortFilter.sort.newest',
			targetValue: 'createdAt',
			sortFunction: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		},
		{
			type: 'oldest',
			label: 'sortFilter.sort.oldest',
			targetValue: 'createdAt',
			sortFunction: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		},
		{
			type: 'favorites',
			label: 'sortFilter.sort.favorites',
			targetValue: 'isFavorite',
			sortFunction: (a, b) => {
				const aFav = a.isFavorite ? 1 : 0;
				const bFav = b.isFavorite ? 1 : 0;
				return bFav - aFav;
			},
		},
		{
			type: 'latest',
			label: 'sortFilter.sort.latest',
			targetValue: 'updatedAt',
			sortFunction: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		},
		{
			type: 'mostChats',
			label: 'sortFilter.sort.mostChats',
			targetValue: 'chatsCount',
			sortFunction: (a, b) => (b.chatsCount || 0) - (a.chatsCount || 0),
		},
		{
			type: 'fewestChats',
			label: 'sortFilter.sort.fewestChats',
			targetValue: 'chatsCount',
			sortFunction: (a, b) => (a.chatsCount || 0) - (b.chatsCount || 0),
		},
		{
			type: 'mostTokens',
			label: 'sortFilter.sort.mostTokens',
			targetValue: 'tokensCount',
			sortFunction: (a, b) => (b.tokensCount || 0) - (a.tokensCount || 0),
		},
		{
			type: 'fewestTokens',
			label: 'sortFilter.sort.fewestTokens',
			targetValue: 'tokensCount',
			sortFunction: (a, b) => (a.tokensCount || 0) - (b.tokensCount || 0),
		},
		{
			type: 'random',
			label: 'sortFilter.sort.random',
			targetValue: 'id',
			sortFunction: () => Math.random() - 0.5,
		},
	];
}
