import React, { useEffect } from 'react';
import { Flex, Box } from '@chakra-ui/react';
import { useUnit } from 'effector-react';
import { createEmptyUserPerson, userPersonsModel } from '@model/user-persons';
import { UserPersonCard } from './user-person-card';
import { LuPlus } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { Drawer } from '@ui/drawer';
import { Pagination } from '../common/pagination';
import { SortFilterControls } from './sort-filter-controls';

export const UserPersonSidebar: React.FC = () => {
	// Используем отфильтрованные и отсортированные элементы с пагинацией
	const persons = useUnit(userPersonsModel.paginationWithSortFilter.$paginatedItems);

	useEffect(() => {
		userPersonsModel.getItemsFx();
		userPersonsModel.getSettingsFx();
	}, []);

	return (
		<Drawer name="userPersons" title="Список персон">
			<Flex direction="column" gap="4">
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
					<Flex direction="column" gap="4">
						{persons.map((person) => (
							<UserPersonCard key={person.id} data={person} />
						))}
					</Flex>
				) : (
					<Box textAlign="center" py={4} color="gray.500">
						Персоны не найдены
					</Box>
				)}

				<Pagination model={userPersonsModel} />
			</Flex>
		</Drawer>
	);
};
