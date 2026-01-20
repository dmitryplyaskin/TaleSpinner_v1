import { Box, Flex, Group, Select, Stack, Switch } from '@mantine/core';
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
	const [items, settings] = useUnit([userPersonsModel.$items, userPersonsModel.$settings]);

	const options = items.map((p) => ({ value: p.id, label: p.name }));

	return (
		<Drawer name="userPersons" title="Список персон">
			<Stack gap="md">
				<Group justify="space-between" align="center" wrap="nowrap">
					<Select
						data={options}
						value={settings?.selectedId ?? null}
						placeholder="Выберите персону"
						onChange={(selectedId) => userPersonsModel.updateSettingsFx({ selectedId: selectedId ?? null })}
						comboboxProps={{ withinPortal: false }}
						style={{ flex: 1 }}
					/>
					<Switch
						label="Enabled"
						checked={Boolean(settings?.enabled)}
						onChange={(e) => userPersonsModel.updateSettingsFx({ enabled: e.currentTarget.checked })}
					/>
				</Group>

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
