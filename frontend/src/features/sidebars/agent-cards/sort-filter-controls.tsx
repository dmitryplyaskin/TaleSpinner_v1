import React, { useState, useEffect } from 'react';
import { Box, Input, Stack, RatingGroup } from '@chakra-ui/react';

import { useUnit } from 'effector-react';
import { FilterState } from '@model/_fabric_/sort-filter-model';
import { agentCardsModel } from '@model/agent-cards';
import { Select } from 'chakra-react-select';
import { Checkbox } from '@ui/chakra-core-ui/checkbox';

export const ChatListSortFilterControls: React.FC = () => {
	// Используем useUnit для доступа к сторам и событиям
	const sortOptions = useUnit(agentCardsModel.sortFilter.$sortOptions);
	const filterOptions = useUnit(agentCardsModel.sortFilter.$filterOptions);
	const sortFilterSettings = useUnit(agentCardsModel.sortFilter.$sortFilterSettings);
	const { setSort, addFilter, removeFilter } = agentCardsModel.sortFilter;

	// Локальное состояние для полей фильтрации
	const [nameFilter, setNameFilter] = useState('');
	const [ratingFilter, setRatingFilter] = useState<number | null>(null);
	const [favoriteFilter, setFavoriteFilter] = useState(false);

	// Инициализация фильтров из настроек
	useEffect(() => {
		const activeFilters = sortFilterSettings.activeFilters;

		// Инициализация фильтра по имени
		const nameFilterState = activeFilters.find((filter) => filter.type === 'byName');
		if (nameFilterState) {
			setNameFilter(nameFilterState.value || '');
		}

		// Инициализация фильтра по рейтингу
		const ratingFilterState = activeFilters.find((filter) => filter.type === 'byRating');
		if (ratingFilterState) {
			setRatingFilter(ratingFilterState.value || null);
		}

		// Инициализация фильтра по избранным
		const favoriteFilterState = activeFilters.find((filter) => filter.type === 'byFavorite');
		if (favoriteFilterState) {
			setFavoriteFilter(favoriteFilterState.value || false);
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

	// Обработчик изменения фильтра по рейтингу
	const handleRatingFilterChange = (value: number | null) => {
		setRatingFilter(value);

		if (value) {
			const filter: FilterState = {
				type: 'byRating',
				value,
			};
			addFilter(filter);
		} else {
			removeFilter('byRating');
		}
	};

	// Обработчик изменения фильтра по избранным
	const handleFavoriteFilterChange = (checked: boolean) => {
		setFavoriteFilter(checked);

		if (checked) {
			const filter: FilterState = {
				type: 'byFavorite',
				value: true,
			};
			addFilter(filter);
		} else {
			removeFilter('byFavorite');
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
		<Stack gap={4} mb={4}>
			<Input
				placeholder="Поиск по имени..."
				value={nameFilter}
				onChange={(e) => handleNameFilterChange(e.target.value)}
			/>

			<Box>
				<Select
					placeholder="Сортировка..."
					options={selectOptions}
					value={selectOptions.find((option) => option.value === sortFilterSettings.currentSortType) || null}
					onChange={(selected) => handleSortChange(selected?.value || null)}
					isClearable
					menuPlacement="auto"
				/>
			</Box>

			<Checkbox checked={favoriteFilter} onCheckedChange={(e) => handleFavoriteFilterChange(!!e.checked)}>
				Только избранные
			</Checkbox>

			<Box>
				<RatingGroup.Root count={5} value={ratingFilter || 0} onValueChange={(e) => handleRatingFilterChange(e.value)}>
					<RatingGroup.HiddenInput />
					<RatingGroup.Control>
						{Array.from({ length: 5 }).map((_, index) => (
							<RatingGroup.Item key={index} index={index + 1}>
								<RatingGroup.ItemIndicator />
							</RatingGroup.Item>
						))}
					</RatingGroup.Control>
				</RatingGroup.Root>
			</Box>
		</Stack>
	);
};
