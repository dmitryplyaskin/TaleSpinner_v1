import { createModel } from '@model/_fabric_';
import { AgentCard } from '@shared/types/agent-card';
import { SortOption, FilterOption } from '@model/_fabric_/sort-filter-model';
import {
	createStringSortFunction,
	createStringFilterFunction,
	createBooleanFilterFunction,
	createDateSortFunction,
} from '@model/_fabric_/sort-filter-helpers';
import { CommonModelSettingsType } from '@shared/types/common-model-types';

// Определяем опции сортировки
const sortOptions: SortOption<AgentCard>[] = [
	{
		type: 'A-Z',
		label: 'По алфавиту (А-Я)',
		targetValue: 'name',
		sortFunction: createStringSortFunction('name', true),
	},
	{
		type: 'Z-A',
		label: 'По алфавиту (Я-А)',
		targetValue: 'name',
		sortFunction: createStringSortFunction('name', false),
	},
	{
		type: 'Сначала новые',
		label: 'Сначала новые',
		targetValue: 'createdAt',
		sortFunction: createDateSortFunction('createdAt', false),
	},
	{
		type: 'Сначала старые',
		label: 'Сначала старые',
		targetValue: 'createdAt',
		sortFunction: createDateSortFunction('createdAt', true),
	},
	{
		type: 'Последние изменённые',
		label: 'Последние изменённые',
		targetValue: 'updatedAt',
		sortFunction: createDateSortFunction('updatedAt', false),
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
		type: 'По рейтингу (высокий)',
		label: 'По рейтингу (высокий)',
		targetValue: 'rating',
		sortFunction: (a, b) => {
			const aRating = a.rating ? parseInt(a.rating) : 0;
			const bRating = b.rating ? parseInt(b.rating) : 0;
			return bRating - aRating;
		},
	},
	{
		type: 'По рейтингу (низкий)',
		label: 'По рейтингу (низкий)',
		targetValue: 'rating',
		sortFunction: (a, b) => {
			const aRating = a.rating ? parseInt(a.rating) : 0;
			const bRating = b.rating ? parseInt(b.rating) : 0;
			return aRating - bRating;
		},
	},
];

// Определяем опции фильтрации
const filterOptions: FilterOption<AgentCard>[] = [
	{
		type: 'byName',
		label: 'По имени',
		targetValue: 'name',
		filterFunction: createStringFilterFunction('name'),
	},
	{
		type: 'byRating',
		label: 'По рейтингу',
		targetValue: 'rating',
		filterFunction: (item, filterValue) => {
			if (!filterValue) return true;
			return item.rating === filterValue;
		},
	},
	{
		type: 'byFavorite',
		label: 'Только избранные',
		targetValue: 'isFavorite',
		filterFunction: createBooleanFilterFunction('isFavorite'),
	},
];

export const chatListModel = createModel<CommonModelSettingsType, AgentCard>({
	settings: {
		route: '/settings/chat-list',
	},
	items: {
		route: '/chat',
	},
	fabricName: 'chat-list',
	sortFilter: {
		defaultSortOptions: sortOptions,
		defaultFilterOptions: filterOptions,
	},
});
