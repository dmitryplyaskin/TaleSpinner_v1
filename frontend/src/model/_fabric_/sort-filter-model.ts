import { createEvent, createStore, sample, combine, Store, Effect } from 'effector';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';

// Функция для получения значения по пути в объекте
export function getValueByPath(obj: any, path: string): any {
	if (!path) return obj;

	const keys = path.split('.');
	let value = obj;

	for (const key of keys) {
		if (value === null || value === undefined) return undefined;
		value = value[key];
	}

	return value;
}

// Типы для сортировки
export interface SortOption<ItemType> {
	type: string;
	label: string;
	targetValue: keyof ItemType | string;
	sortFunction: (a: ItemType, b: ItemType) => number;
}

// Типы для фильтрации
export interface FilterOption<ItemType> {
	type: string;
	label: string;
	targetValue: keyof ItemType | string;
	filterFunction: (item: ItemType, filterValue: any) => boolean;
}

export interface FilterState {
	type: string;
	value: any;
}

export interface SortFilterSettings {
	currentSortType: string | null;
	activeFilters: FilterState[];
}

export interface SortFilterModel<ItemType extends CommonModelItemType, SettingsType extends CommonModelSettingsType> {
	// Сторы
	$sortOptions: Store<SortOption<ItemType>[]>;
	$filterOptions: Store<FilterOption<ItemType>[]>;
	$sortFilterSettings: Store<SortFilterSettings>;
	$filteredItems: Store<ItemType[]>;
	$sortedItems: Store<ItemType[]>;
	$filteredAndSortedItems: Store<ItemType[]>;

	// События
	setSort: (sortType: string | null) => void;
	addFilter: (filter: FilterState) => void;
	removeFilter: (filterType: string) => void;
	clearFilters: () => void;

	// Методы для расширения
	addSortOption: (option: SortOption<ItemType>) => void;
	addFilterOption: (option: FilterOption<ItemType>) => void;
}

export const createSortFilterModel = <
	ItemType extends CommonModelItemType,
	SettingsType extends CommonModelSettingsType,
>(
	$items: Store<ItemType[]>,
	defaultSortOptions: SortOption<ItemType>[] = [],
	defaultFilterOptions: FilterOption<ItemType>[] = [],
	updateSettingsFx?: Effect<Partial<SettingsType>, any>,
): SortFilterModel<ItemType, SettingsType> => {
	// События
	const setSort = createEvent<string | null>();
	const addFilter = createEvent<FilterState>();
	const removeFilter = createEvent<string>();
	const clearFilters = createEvent();

	// События для расширения опций
	const addSortOption = createEvent<SortOption<ItemType>>();
	const addFilterOption = createEvent<FilterOption<ItemType>>();

	// Сторы для опций
	const $sortOptions = createStore<SortOption<ItemType>[]>(defaultSortOptions);
	const $filterOptions = createStore<FilterOption<ItemType>[]>(defaultFilterOptions);

	// Стор с настройками сортировки и фильтрации
	const $sortFilterSettings = createStore<SortFilterSettings>({
		currentSortType: null,
		activeFilters: [],
	});

	// Обработчики событий
	$sortFilterSettings
		.on(setSort, (state, sortType) => ({
			...state,
			currentSortType: sortType,
		}))
		.on(addFilter, (state, filter) => {
			// Если фильтр с таким типом уже существует, заменяем его
			const existingFilterIndex = state.activeFilters.findIndex((f) => f.type === filter.type);

			if (existingFilterIndex !== -1) {
				const newFilters = [...state.activeFilters];
				newFilters[existingFilterIndex] = filter;
				return {
					...state,
					activeFilters: newFilters,
				};
			}

			// Иначе добавляем новый фильтр
			return {
				...state,
				activeFilters: [...state.activeFilters, filter],
			};
		})
		.on(removeFilter, (state, filterType) => ({
			...state,
			activeFilters: state.activeFilters.filter((f) => f.type !== filterType),
		}))
		.on(clearFilters, (state) => ({
			...state,
			activeFilters: [],
		}));

	// Добавление новых опций
	$sortOptions.on(addSortOption, (state, option) => {
		// Проверяем, существует ли уже опция с таким типом
		if (state.some((opt) => opt.type === option.type)) {
			return state.map((opt) => (opt.type === option.type ? option : opt));
		}
		return [...state, option];
	});

	$filterOptions.on(addFilterOption, (state, option) => {
		// Проверяем, существует ли уже опция с таким типом
		if (state.some((opt) => opt.type === option.type)) {
			return state.map((opt) => (opt.type === option.type ? option : opt));
		}
		return [...state, option];
	});

	// Применение фильтров
	const $filteredItems = combine($items, $filterOptions, $sortFilterSettings, (items, filterOptions, settings) => {
		if (settings.activeFilters.length === 0) {
			return items;
		}

		return items.filter((item) => {
			// Элемент должен соответствовать всем активным фильтрам
			return settings.activeFilters.every((activeFilter) => {
				const filterOption = filterOptions.find((opt) => opt.type === activeFilter.type);
				if (!filterOption) return true; // Если опция фильтра не найдена, пропускаем

				return filterOption.filterFunction(item, activeFilter.value);
			});
		});
	});

	// Применение сортировки
	const $sortedItems = combine($filteredItems, $sortOptions, $sortFilterSettings, (items, sortOptions, settings) => {
		if (!settings.currentSortType) {
			return items;
		}

		const sortOption = sortOptions.find((opt) => opt.type === settings.currentSortType);
		if (!sortOption) {
			return items;
		}

		return [...items].sort(sortOption.sortFunction);
	});

	// Итоговый результат (отфильтрованный и отсортированный)
	const $filteredAndSortedItems = $sortedItems;

	// Сохранение настроек, если предоставлен updateSettingsFx
	if (updateSettingsFx) {
		sample({
			source: $sortFilterSettings,
			fn: (settings) =>
				({
					sortType: settings.currentSortType,
					filters: settings.activeFilters,
				} as unknown as Partial<SettingsType>),
			target: updateSettingsFx,
		});
	}

	return {
		// Сторы
		$sortOptions,
		$filterOptions,
		$sortFilterSettings,
		$filteredItems,
		$sortedItems,
		$filteredAndSortedItems,

		// События
		setSort,
		addFilter,
		removeFilter,
		clearFilters,

		// Методы расширения
		addSortOption,
		addFilterOption,
	};
};

// Вспомогательные функции для создания опций сортировки и фильтрации с поддержкой вложенных путей

// Создает функцию сортировки для строковых значений
export function createStringSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = getValueByPath(a, path) || '';
		const valueB = getValueByPath(b, path) || '';
		return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
	};
}

// Создает функцию сортировки для числовых значений
export function createNumberSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = getValueByPath(a, path) || 0;
		const valueB = getValueByPath(b, path) || 0;
		return ascending ? valueA - valueB : valueB - valueA;
	};
}

// Создает функцию сортировки для дат
export function createDateSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = new Date(getValueByPath(a, path) || 0).getTime();
		const valueB = new Date(getValueByPath(b, path) || 0).getTime();
		return ascending ? valueA - valueB : valueB - valueA;
	};
}

// Создает функцию фильтрации для строковых значений (поиск подстроки)
export function createStringFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: string) => boolean {
	return (item, filterValue) => {
		if (!filterValue) return true;
		const value = String(getValueByPath(item, path) || '').toLowerCase();
		return value.includes(filterValue.toLowerCase());
	};
}

// Создает функцию фильтрации для числовых значений (равенство)
export function createNumberFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: number) => boolean {
	return (item, filterValue) => {
		if (filterValue === undefined || filterValue === null) return true;
		const value = getValueByPath(item, path);
		return value === filterValue;
	};
}

// Создает функцию фильтрации для числовых значений (диапазон)
export function createNumberRangeFilterFunction<ItemType>(
	path: string,
): (item: ItemType, filterValue: { min?: number; max?: number }) => boolean {
	return (item, filterValue) => {
		if (!filterValue) return true;

		const value = getValueByPath(item, path);
		if (value === undefined || value === null) return false;

		const { min, max } = filterValue;
		if (min !== undefined && value < min) return false;
		if (max !== undefined && value > max) return false;

		return true;
	};
}

// Создает функцию фильтрации для булевых значений
export function createBooleanFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: boolean) => boolean {
	return (item, filterValue) => {
		if (filterValue === undefined || filterValue === null) return true;
		const value = getValueByPath(item, path);
		return value === filterValue;
	};
}
