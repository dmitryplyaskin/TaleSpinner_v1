import { Tabs } from '@mantine/core';
import { useState } from 'react';

import { Drawer } from '@ui/drawer';

import { APIProviderTab } from './api-provoder-tab';
import { SamplerSettingsTab } from './settings-tab';

type TabType = 'settings' | 'provider';

export const SettingsSidebar = () => {
	const [activeTab, setActiveTab] = useState<TabType>('settings');

	return (
		<Drawer name="settings" title="Settings">
			<Tabs value={activeTab} onChange={(v) => setActiveTab((v as TabType) ?? 'settings')} variant="outline">
				<Tabs.List mb="md">
					<Tabs.Tab value="settings">Настройки LLM</Tabs.Tab>
					<Tabs.Tab value="provider">API Provider</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="settings">
					<SamplerSettingsTab />
				</Tabs.Panel>
				<Tabs.Panel value="provider">
					<APIProviderTab />
				</Tabs.Panel>
			</Tabs>
		</Drawer>
	);
};
