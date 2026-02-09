import { type UserPersonType, type UserPersonSettingsType } from '@shared/types/user-person';
import { v4 as uuidv4 } from 'uuid';

import { createModel } from '@model/_fabric_';
import { createStringSortFunction, createStringFilterFunction } from '@model/_fabric_/sort-filter-helpers';
import { type SortOption, type FilterOption } from '@model/_fabric_/sort-filter-model';
import i18n from '../../i18n';

// Определяем опции сортировки
const sortOptions: SortOption<UserPersonType>[] = [
	{
		type: 'A-Z',
		label: 'sortFilter.sort.alphaAsc',
		targetValue: 'name',
		sortFunction: createStringSortFunction('name', true),
	},
	{
		type: 'Z-A',
		label: 'sortFilter.sort.alphaDesc',
		targetValue: 'name',
		sortFunction: createStringSortFunction('name', false),
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
		type: 'latest',
		label: 'sortFilter.sort.latest',
		targetValue: 'updatedAt',
		sortFunction: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	},
];

// Определяем опции фильтрации
const filterOptions: FilterOption<UserPersonType>[] = [
	{
		type: 'byName',
		label: 'sortFilter.filters.byName',
		targetValue: 'name',
		filterFunction: createStringFilterFunction('name'),
	},
];

export const userPersonsModel = createModel<UserPersonSettingsType, UserPersonType>({
	settings: {
		route: '/settings/user-persons',
	},
	items: {
		route: '/user-persons',
	},
	fabricName: 'user-persons',
	sortFilter: {
		defaultSortOptions: sortOptions,
		defaultFilterOptions: filterOptions,
	},
});

export const createEmptyUserPerson = (): UserPersonType => ({
	id: uuidv4(),
	name: i18n.t('userPersons.defaults.newPerson'),
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	type: 'default',
});
