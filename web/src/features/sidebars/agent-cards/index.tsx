import { Button, Group, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuPlus } from 'react-icons/lu';

import { $entityProfiles, createEntityProfileFx } from '@model/chat-core';
import { Drawer } from '@ui/drawer';

import { AgentCard } from './agent-card';

export const AgentCardsSidebar: React.FC = () => {
	const list = useUnit($entityProfiles);

	return (
		<>
			<Drawer name="agentCards" title="Entity profiles">
				<Stack gap="md">
					<Group gap="md">
						<Button
							onClick={() => createEntityProfileFx({ name: `New profile ${new Date().toLocaleTimeString()}` })}
							leftSection={<LuPlus />}
						>
							Создать профиль
						</Button>
					</Group>

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
				</Stack>
			</Drawer>
		</>
	);
};
