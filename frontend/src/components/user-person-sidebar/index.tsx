import React, { useEffect } from 'react';
import { Flex, Heading } from '@chakra-ui/react';
import { DrawerRoot, DrawerContent, DrawerHeader, DrawerBody } from '../../ui/chakra-core-ui/drawer';
import { $sidebars, closeSidebar } from '@model/sidebars';
import { useUnit } from 'effector-react';
import { CloseButton } from '@ui/chakra-core-ui/close-button';
import { $userPersons, getUserPersonListFx, createUserPerson, createEmptyUserPerson } from '@model/user-persons';
import { UserPersonCard } from './user-person-card';
import { LuPlus } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

export const UserPersonSidebar: React.FC = () => {
	const persons = useUnit($userPersons);
	const { userPersons: isOpen } = useUnit($sidebars);

	const handleClose = () => {
		closeSidebar('userPersons');
	};

	useEffect(() => {
		getUserPersonListFx();
	}, []);

	if (!isOpen) return null;

	return (
		<DrawerRoot open={isOpen} placement="start" size="lg" onOpenChange={handleClose}>
			<DrawerContent>
				<DrawerHeader borderBottomWidth="1px">
					<Flex justify="space-between" align="center">
						<Heading size="md">Список персон</Heading>
						<Flex gap={2}>
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

							<CloseButton onClick={handleClose} />
						</Flex>
					</Flex>
				</DrawerHeader>

				<DrawerBody>
					<Flex direction="column" gap="4">
						{persons.map((person) => (
							<UserPersonCard key={person.id} data={person} />
						))}
					</Flex>
				</DrawerBody>
			</DrawerContent>
		</DrawerRoot>
	);
};
