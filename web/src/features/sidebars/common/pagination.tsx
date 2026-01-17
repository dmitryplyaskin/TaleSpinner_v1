import { Box, Flex, HStack } from '@chakra-ui/react';
import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { Select } from 'chakra-react-select';
import { useUnit } from 'effector-react';

import { type createModel } from '@model/_fabric_';
import {
	PaginationRoot,
	PaginationPrevTrigger,
	PaginationItems,
	PaginationNextTrigger,
} from '@ui/chakra-core-ui/pagination';

type PaginationProps<SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType> = {
	model: ReturnType<typeof createModel<SettingsType, ItemType>>;
};

export const Pagination = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>({
	model,
}: PaginationProps<SettingsType, ItemType>) => {
	const { paginationWithSortFilter } = model;
	const paginationSettings = useUnit(paginationWithSortFilter.$paginationSettings);

	const options = [
		{ label: '10', value: 10 },
		{ label: '20', value: 20 },
		{ label: '50', value: 50 },
	];

	return (
		<Flex justifyContent="center" alignItems="center" w="full" mt={4} gap={4}>
			<PaginationRoot
				count={paginationSettings.totalItems}
				pageSize={paginationSettings.pageSize}
				page={paginationSettings.currentPage}
				onPageChange={(e) => paginationWithSortFilter.setCurrentPage(e.page)}
			>
				<HStack>
					<PaginationPrevTrigger />
					<PaginationItems />
					<PaginationNextTrigger />
				</HStack>
			</PaginationRoot>
			<Box w="100px">
				<Select
					value={options.find((option) => option.value === paginationSettings.pageSize)}
					options={options}
					onChange={(e) => paginationWithSortFilter.setPageSize(e?.value || 10)}
				/>
			</Box>
		</Flex>
	);
};
