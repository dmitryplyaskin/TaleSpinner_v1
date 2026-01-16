import React, { useEffect, useState } from 'react';
import { SamplerSettingsTab } from './settings-tab';
import { APIProviderTab } from './api-provoder-tab';

import { Tabs } from '@chakra-ui/react';

import { Drawer } from '@ui/drawer';
import { samplersModel } from '@model/samplers';

interface SettingsSidebarProps {
	// onAPIConfigChange: (config: OpenRouterConfig) => void;
	// apiConfig: OpenRouterConfig | null;
}

type TabType = 'settings' | 'provider';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = () => {
	const [activeTab, setActiveTab] = useState<TabType>('settings');

	useEffect(() => {
		samplersModel.getItemsFx();
		samplersModel.getSettingsFx();
	}, []);

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
