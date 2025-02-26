export interface FabricSettings<SettingsType> {
	defaultValue?: SettingsType;
	route: string;
}

export interface FabricItems<ItemType> {
	defaultValue?: ItemType[];
	route: string;
}

export interface FabricPagination {
	defaultPageSize?: number;
}

// Импортируем типы для сортировки и фильтрации
import { SortOption, FilterOption } from './sort-filter-model';

export interface FabricSortFilter<ItemType> {
	defaultSortOptions?: SortOption<ItemType>[];
	defaultFilterOptions?: FilterOption<ItemType>[];
}

export interface Fabric<SettingsType, ItemType> {
	settings: FabricSettings<SettingsType>;
	items: FabricItems<ItemType>;
	fabricName: string;
	pagination?: FabricPagination;
	sortFilter?: FabricSortFilter<ItemType>; // Добавляем поддержку сортировки и фильтрации
}
