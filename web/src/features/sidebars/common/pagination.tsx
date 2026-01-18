import { Group, Pagination as MantinePagination, Select } from '@mantine/core';
import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { useUnit } from 'effector-react';

import { type createModel } from '@model/_fabric_';

type PaginationProps<SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType> = {
	model: ReturnType<typeof createModel<SettingsType, ItemType>>;
};

export const Pagination = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>({
	model,
}: PaginationProps<SettingsType, ItemType>) => {
	const { paginationWithSortFilter } = model;
	const paginationSettings = useUnit(paginationWithSortFilter.$paginationSettings);

	const pageSizeOptions = [
		{ label: '10', value: '10' },
		{ label: '20', value: '20' },
		{ label: '50', value: '50' },
	] as const;

	const totalPages = Math.max(1, Math.ceil(paginationSettings.totalItems / paginationSettings.pageSize));

	return (
		<Group justify="center" align="center" w="100%" mt="md" gap="md">
			<MantinePagination
				total={totalPages}
				value={paginationSettings.currentPage}
				onChange={(page) => paginationWithSortFilter.setCurrentPage(page)}
				withEdges
			/>
			<Select
				w={100}
				data={pageSizeOptions}
				value={String(paginationSettings.pageSize)}
				onChange={(v) => paginationWithSortFilter.setPageSize(Number(v ?? 10))}
				comboboxProps={{ withinPortal: false }}
			/>
		</Group>
	);
};
