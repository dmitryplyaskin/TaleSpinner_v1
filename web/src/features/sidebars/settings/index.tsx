import { Tabs } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Drawer } from '@ui/drawer';

import { APIProviderTab } from './api-provoder-tab';
import { SamplerSettingsTab } from './settings-tab';

type TabType = 'settings' | 'provider';

export const SettingsSidebar = () => {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<TabType>('settings');

	return (
		<Drawer name="settings" title={t('sidebars.settingsTitle')}>
			<Tabs value={activeTab} onChange={(v) => setActiveTab((v as TabType) ?? 'settings')} variant="outline">
				<Tabs.List mb="md">
					<Tabs.Tab value="settings">{t('sidebars.llmSettings')}</Tabs.Tab>
					<Tabs.Tab value="provider">{t('sidebars.apiProvider')}</Tabs.Tab>
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
