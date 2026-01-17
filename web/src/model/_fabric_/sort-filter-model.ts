import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { createEvent, createStore, sample, combine, type Store, type Effect } from 'effector';

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

export interface SortFilterModel<ItemType extends CommonModelItemType> {
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
	getSettingsFx?: Effect<void, { data: SettingsType }>,
): SortFilterModel<ItemType> => {
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

	const $sort = $sortFilterSettings.map((x) => x.currentSortType);

	// Сохранение только типа сортировки, если предоставлен updateSettingsFx
	if (updateSettingsFx) {
		sample({
			source: $sort,
			fn: (settings) =>
				({
					sortType: settings,
					// Удаляем сохранение фильтров
				} as unknown as Partial<SettingsType>),
			target: updateSettingsFx,
		});
	}

	// I don't like this code, but it works
	let firstSettingsInit = false;
	if (getSettingsFx) {
		getSettingsFx.doneData.watch(({ data }) => {
			if (!firstSettingsInit) {
				firstSettingsInit = true;
				if (data.sortType) {
					setSort(data.sortType);
				}
			}
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

// Экспортируем вспомогательные функции из нового файла
export * from './sort-filter-helpers';
