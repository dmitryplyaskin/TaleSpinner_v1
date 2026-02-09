import { Box, Flex, Group, Select, Stack, Switch } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus } from 'react-icons/lu';

import { createEmptyUserPerson, userPersonsModel } from '@model/user-persons';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { Pagination } from '../common/pagination';

import { SortFilterControls } from './sort-filter-controls';
import { UserPersonCard } from './user-person-card';

export const UserPersonSidebar: React.FC = () => {
	const { t } = useTranslation();
	const persons = useUnit(userPersonsModel.paginationWithSortFilter.$paginatedItems);
	const [items, settings] = useUnit([userPersonsModel.$items, userPersonsModel.$settings]);

	const options = items.map((p) => ({ value: p.id, label: p.name }));

	return (
		<Drawer name="userPersons" title={t('sidebars.userPersonsTitle')}>
			<Stack gap="md">
				<Group justify="space-between" align="center" wrap="nowrap" className="ts-sidebar-toolbar">
					<Select
						data={options}
						value={settings?.selectedId ?? null}
						placeholder={t('sidebars.selectPerson')}
						onChange={(selectedId) => userPersonsModel.updateSettingsFx({ selectedId: selectedId ?? null })}
						comboboxProps={{ withinPortal: false }}
						className="ts-sidebar-toolbar__main"
					/>
					<Switch
						label={t('common.enabled')}
						checked={Boolean(settings?.enabled)}
						onChange={(e) => userPersonsModel.updateSettingsFx({ enabled: e.currentTarget.checked })}
					/>
				</Group>

				<Flex justify="flex-end">
					<IconButtonWithTooltip
						tooltip={t('sidebars.addPerson')}
						variant="ghost"
						size="sm"
						colorPalette="cyan"
						aria-label={t('sidebars.addPerson')}
						onClick={() => {
							userPersonsModel.createItemFx(createEmptyUserPerson());
						}}
						icon={<LuPlus />}
					/>
				</Flex>

				<Box>
					<SortFilterControls model={userPersonsModel} nameFilterPlaceholder={t('userPersons.placeholders.searchByName')} />
				</Box>

				{persons.length > 0 ? (
					<Stack gap="md">
						{persons.map((person) => (
							<UserPersonCard key={person.id} data={person} />
						))}
					</Stack>
				) : (
					<Box style={{ textAlign: 'center', padding: 16, color: 'var(--mantine-color-dimmed)' }}>{t('sidebars.personsEmpty')}</Box>
				)}

				<Pagination model={userPersonsModel} />
			</Stack>
		</Drawer>
	);
};
