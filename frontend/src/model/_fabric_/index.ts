import { combine, sample } from 'effector';
import { Fabric } from './types';
import { createSettingsModel } from './setting-model';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';
import { createItemsModel } from './items-model';
import { createPaginationModel } from './pagination-model';
import { createSortFilterModel, SortOption, FilterOption } from './sort-filter-model';

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

	const pagination = createPaginationModel(
		$items,
		fabric.pagination?.defaultPageSize || 10,
		updateSettingsFx,
		getSettingsFx,
	);

	const sortFilter = createSortFilterModel(
		$items,
		fabric.sortFilter?.defaultSortOptions || getDefaultSortOptions<ItemType>(),
		fabric.sortFilter?.defaultFilterOptions || [],
		updateSettingsFx,
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

		pagination,
		paginationWithSortFilter,

		sortFilter,
	};
};

function getDefaultSortOptions<ItemType extends CommonModelItemType>(): SortOption<ItemType>[] {
	return [
		{
			type: 'A-Z',
			label: 'По алфавиту (А-Я)',
			targetValue: 'name',
			sortFunction: (a, b) => (a.name || '').localeCompare(b.name || ''),
		},
		{
			type: 'Z-A',
			label: 'По алфавиту (Я-А)',
			targetValue: 'name',
			sortFunction: (a, b) => (b.name || '').localeCompare(a.name || ''),
		},
		{
			type: 'Сначала новые',
			label: 'Сначала новые',
			targetValue: 'createdAt',
			sortFunction: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		},
		{
			type: 'Сначала старые',
			label: 'Сначала старые',
			targetValue: 'createdAt',
			sortFunction: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		},
		{
			type: 'Избранные',
			label: 'Избранные',
			targetValue: 'isFavorite',
			sortFunction: (a, b) => {
				const aFav = a.isFavorite ? 1 : 0;
				const bFav = b.isFavorite ? 1 : 0;
				return bFav - aFav;
			},
		},
		{
			type: 'Последние',
			label: 'Последние изменённые',
			targetValue: 'updatedAt',
			sortFunction: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		},
		{
			type: 'Больше всего чатов',
			label: 'Больше всего чатов',
			targetValue: 'chatsCount',
			sortFunction: (a, b) => (b.chatsCount || 0) - (a.chatsCount || 0),
		},
		{
			type: 'Меньше всего чатов',
			label: 'Меньше всего чатов',
			targetValue: 'chatsCount',
			sortFunction: (a, b) => (a.chatsCount || 0) - (b.chatsCount || 0),
		},
		{
			type: 'Больше всего токенов',
			label: 'Больше всего токенов',
			targetValue: 'tokensCount',
			sortFunction: (a, b) => (b.tokensCount || 0) - (a.tokensCount || 0),
		},
		{
			type: 'Меньше всего токенов',
			label: 'Меньше всего токенов',
			targetValue: 'tokensCount',
			sortFunction: (a, b) => (a.tokensCount || 0) - (b.tokensCount || 0),
		},
		{
			type: 'Случайно',
			label: 'Случайно',
			targetValue: 'id',
			sortFunction: () => Math.random() - 0.5,
		},
	];
}
