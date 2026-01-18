import { Tabs } from '@chakra-ui/react';
import { useState } from 'react';

import { samplersModel } from '@model/samplers';
import { Drawer } from '@ui/drawer';

import { APIProviderTab } from './api-provoder-tab';
import { SamplerSettingsTab } from './settings-tab';

type TabType = 'settings' | 'provider';

export const SettingsSidebar = () => {
	const [activeTab, setActiveTab] = useState<TabType>('settings');

	return (
		<Drawer name="settings" title="Settings">
			<Tabs.Root
				colorPalette={'purple'}
				size={'md'}
				variant={'enclosed'}
				value={activeTab}
				onValueChange={(e) => setActiveTab(e.value as TabType)}
			>
				<Tabs.List mb={6}>
					<Tabs.Trigger value="settings">Настройки LLM</Tabs.Trigger>
					<Tabs.Trigger value="provider">API Provider</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="settings" p={0}>
					<SamplerSettingsTab />
				</Tabs.Content>
				<Tabs.Content value="provider">
					<APIProviderTab />
				</Tabs.Content>
			</Tabs.Root>
		</Drawer>
	);
};
