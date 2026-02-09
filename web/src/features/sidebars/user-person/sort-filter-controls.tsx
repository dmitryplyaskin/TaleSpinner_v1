import { Box, Flex, Select, TextInput } from '@mantine/core';
import { type CommonModelItemType } from '@shared/types/common-model-types';
import { useUnit } from 'effector-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { type FilterState , type SortFilterModel } from '@model/_fabric_/sort-filter-model';



interface SortFilterControlsProps<ItemType extends CommonModelItemType> {
	model: {
		sortFilter: SortFilterModel<ItemType>;
	};
	nameFilterPlaceholder?: string;
}

export function SortFilterControls<ItemType extends CommonModelItemType>({
	model,
	nameFilterPlaceholder,
}: SortFilterControlsProps<ItemType>) {
	const { t } = useTranslation();
	// Используем useUnit для доступа к сторам
	const sortOptions = useUnit(model.sortFilter.$sortOptions);
	const sortFilterSettings = useUnit(model.sortFilter.$sortFilterSettings);
	const { setSort, addFilter, removeFilter } = model.sortFilter;

	// Локальное состояние для поля ввода
	const [nameFilter, setNameFilter] = useState('');

	// Инициализация фильтра по имени из настроек
	useEffect(() => {
		const nameFilterState = sortFilterSettings.activeFilters.find((filter) => filter.type === 'byName');
		if (nameFilterState) {
			setNameFilter(nameFilterState.value || '');
		}
	}, [sortFilterSettings.activeFilters]);

	// Обработчик изменения фильтра по имени
	const handleNameFilterChange = (value: string) => {
		setNameFilter(value);

		if (value) {
			const filter: FilterState = {
				type: 'byName',
				value,
			};
			addFilter(filter);
		} else {
			removeFilter('byName');
		}
	};

	// Обработчик изменения сортировки
	const handleSortChange = (sortType: string | null) => {
		setSort(sortType);
	};

	// Преобразуем опции сортировки для Select
	const selectOptions = sortOptions.map((option) => ({
		value: option.type,
		label: mapSortTypeLabel(option.type, t),
	}));

	return (
		<Flex gap="md" mb="md">
			<TextInput
				placeholder={nameFilterPlaceholder ?? t('sortFilter.placeholders.searchByName')}
				value={nameFilter}
				onChange={(e) => handleNameFilterChange(e.target.value)}
			/>

			<Box w={350}>
				<Select
					placeholder={t('sortFilter.placeholders.sort')}
					data={selectOptions}
					value={sortFilterSettings.currentSortType ?? null}
					onChange={(selected) => handleSortChange(selected)}
					clearable
					comboboxProps={{ withinPortal: false }}
				/>
			</Box>
		</Flex>
	);
}

function mapSortTypeLabel(type: string, t: (key: string) => string): string {
	switch (type) {
		case 'A-Z':
			return t('sortFilter.sort.alphaAsc');
		case 'Z-A':
			return t('sortFilter.sort.alphaDesc');
		case 'newest':
		case 'Сначала новые':
		case 'Newest':
			return t('sortFilter.sort.newest');
		case 'oldest':
		case 'Сначала старые':
		case 'Oldest':
			return t('sortFilter.sort.oldest');
		case 'latest':
		case 'Последние изменённые':
		case 'Последние':
		case 'Latest':
			return t('sortFilter.sort.latest');
		case 'favorites':
		case 'Избранные':
			return t('sortFilter.sort.favorites');
		case 'mostChats':
		case 'Больше всего чатов':
			return t('sortFilter.sort.mostChats');
		case 'fewestChats':
		case 'Меньше всего чатов':
			return t('sortFilter.sort.fewestChats');
		case 'mostTokens':
		case 'Больше всего токенов':
			return t('sortFilter.sort.mostTokens');
		case 'fewestTokens':
		case 'Меньше всего токенов':
			return t('sortFilter.sort.fewestTokens');
		case 'random':
		case 'Случайно':
			return t('sortFilter.sort.random');
		default:
			return type;
	}
}
