import { ActionIcon, Box, Checkbox, Divider, Group, Rating, Select, Stack, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useState, useEffect } from 'react';
import { LuX } from 'react-icons/lu';

import { type FilterState } from '@model/_fabric_/sort-filter-model';
import { agentCardsModel } from '@model/agent-cards';

export const ChatListSortFilterControls: React.FC = () => {
	// Используем useUnit для доступа к сторам и событиям
	const sortOptions = useUnit(agentCardsModel.sortFilter.$sortOptions);
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
		<Stack gap="md" mb="md">
			<Group gap="sm" wrap="nowrap">
				<TextInput
					placeholder="Поиск по имени..."
					value={nameFilter}
					onChange={(e) => handleNameFilterChange(e.target.value)}
				/>

				<Box w={350}>
					<Select
						placeholder="Сортировка..."
						data={selectOptions}
						value={sortFilterSettings.currentSortType ?? null}
						onChange={(selected) => handleSortChange(selected)}
						clearable
						comboboxProps={{ withinPortal: false }}
					/>
				</Box>
			</Group>
			<Group gap="sm">
				<Checkbox
					checked={favoriteFilter}
					onChange={(e) => handleFavoriteFilterChange(e.currentTarget.checked)}
					label="Только избранные"
				/>
				<Divider orientation="vertical" />
				<Group gap="xs">
					<Rating
						count={5}
						value={ratingFilter ?? 0}
						onChange={(v) => handleRatingFilterChange(v ? v : null)}
					/>
					<ActionIcon aria-label="Clear rating" variant="outline" size="sm" onClick={() => handleRatingFilterChange(null)}>
						<LuX />
					</ActionIcon>
				</Group>
			</Group>
		</Stack>
	);
};
