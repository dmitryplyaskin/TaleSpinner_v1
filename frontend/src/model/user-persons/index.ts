import { createModel } from '@model/_fabric_';
import { UserPersonType, UserPersonSettingsType } from '@shared/types/user-person';
import { v4 as uuidv4 } from 'uuid';
import {
	createStringSortFunction,
	createStringFilterFunction,
	SortOption,
	FilterOption,
} from '@model/_fabric_/sort-filter-model';

// Определяем опции сортировки
const sortOptions: SortOption<UserPersonType>[] = [
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
		sortFunction: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	},
	{
		type: 'Сначала старые',
		label: 'Сначала старые',
		targetValue: 'createdAt',
		sortFunction: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	},
	{
		type: 'Последние изменённые',
		label: 'Последние изменённые',
		targetValue: 'updatedAt',
		sortFunction: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	},
];

// Определяем опции фильтрации
const filterOptions: FilterOption<UserPersonType>[] = [
	{
		type: 'byName',
		label: 'По имени',
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
	name: 'Новый пользователь',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	type: 'default',
});
