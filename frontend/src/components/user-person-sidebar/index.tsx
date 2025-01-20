import React, { useEffect } from 'react';
import { Flex } from '@chakra-ui/react';
import { useUnit } from 'effector-react';
import { $userPersons, getUserPersonListFx, createUserPerson, createEmptyUserPerson } from '@model/user-persons';
import { UserPersonCard } from './user-person-card';
import { LuPlus } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { Drawer } from '@ui/drawer';

export const UserPersonSidebar: React.FC = () => {
	const persons = useUnit($userPersons);

	useEffect(() => {
		getUserPersonListFx();
	}, []);

	return (
		<Drawer name="userPersons" title="Список персон">
			<IconButtonWithTooltip
				tooltip="Добавить персону"
				variant="ghost"
				size="sm"
				colorPalette="blue"
				aria-label="Add person"
				onClick={() => {
					createUserPerson(createEmptyUserPerson());
				}}
				icon={<LuPlus />}
			/>
			<Flex direction="column" gap="4">
				{persons.map((person) => (
					<UserPersonCard key={person.id} data={person} />
				))}
			</Flex>
		</Drawer>
	);
};
