import { Button, Group, Stack } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus } from 'react-icons/lu';

import { $entityProfiles, createEntityProfileFx } from '@model/chat-core';
import { Drawer } from '@ui/drawer';

import { AgentCard } from './agent-card';
import { Upload } from './components/upload';

export const AgentCardsSidebar: React.FC = () => {
	const { t } = useTranslation();
	const list = useUnit($entityProfiles);

	return (
		<>
			<Drawer name="agentCards" title={t('sidebars.agentProfilesTitle')}>
				<Stack gap="md">
					<Group gap="md" className="ts-sidebar-toolbar">
						<Button
							onClick={() => createEntityProfileFx({ name: `New profile ${new Date().toLocaleTimeString()}` })}
							leftSection={<LuPlus />}
							color="cyan"
						>
							{t('sidebars.createProfile')}
						</Button>
						<Upload />
					</Group>

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
				</Stack>
			</Drawer>
		</>
	);
};
