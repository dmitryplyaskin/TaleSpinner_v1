import { Box, Flex, Input } from '@chakra-ui/react';
import { type CommonModelItemType } from '@shared/types/common-model-types';
import { Select } from 'chakra-react-select';
import { useUnit } from 'effector-react';
import { useState, useEffect } from 'react';

import { type FilterState , type SortFilterModel } from '@model/_fabric_/sort-filter-model';



interface SortFilterControlsProps<ItemType extends CommonModelItemType> {
	model: {
		sortFilter: SortFilterModel<ItemType>;
	};
	nameFilterPlaceholder?: string;
}

export function SortFilterControls<ItemType extends CommonModelItemType>({
	model,
}: SortFilterControlsProps<ItemType>) {
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
		label: option.label,
	}));

	return (
		<Flex gap={4} mb={4}>
			<Input
				placeholder={'Поиск по имени...'}
				value={nameFilter}
				onChange={(e) => handleNameFilterChange(e.target.value)}
			/>

			<Box w="350px">
				<Select
					placeholder="Сортировка..."
					options={selectOptions}
					value={selectOptions.find((option) => option.value === sortFilterSettings.currentSortType) || null}
					onChange={(selected) => handleSortChange(selected?.value || null)}
					isClearable
					menuPlacement="auto"
				/>
			</Box>
		</Flex>
	);
}
