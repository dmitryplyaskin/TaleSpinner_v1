import { Box, Flex, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuPlus } from 'react-icons/lu';

import { createEmptyUserPerson, userPersonsModel } from '@model/user-persons';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { Pagination } from '../common/pagination';

import { SortFilterControls } from './sort-filter-controls';
import { UserPersonCard } from './user-person-card';

export const UserPersonSidebar: React.FC = () => {
	// Используем отфильтрованные и отсортированные элементы с пагинацией
	const persons = useUnit(userPersonsModel.paginationWithSortFilter.$paginatedItems);

	return (
		<Drawer name="userPersons" title="Список персон">
			<Stack gap="md">
				<Flex justify="flex-end">
					<IconButtonWithTooltip
						tooltip="Добавить персону"
						variant="ghost"
						size="sm"
						colorPalette="blue"
						aria-label="Add person"
						onClick={() => {
							userPersonsModel.createItemFx(createEmptyUserPerson());
						}}
						icon={<LuPlus />}
					/>
				</Flex>

				{/* Добавляем элементы управления сортировкой и фильтрацией */}
				<Box>
					<SortFilterControls model={userPersonsModel} nameFilterPlaceholder="Поиск персоны по имени..." />
				</Box>

				{persons.length > 0 ? (
					<Stack gap="md">
						{persons.map((person) => (
							<UserPersonCard key={person.id} data={person} />
						))}
					</Stack>
				) : (
					<Box style={{ textAlign: 'center', padding: 16, color: 'var(--mantine-color-dimmed)' }}>
						Персоны не найдены
					</Box>
				)}

				<Pagination model={userPersonsModel} />
			</Stack>
		</Drawer>
	);
};
