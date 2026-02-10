import { Box, Checkbox, SegmentedControl, Stack, Tabs, Text, Title, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { type AppSettings } from '@shared/types/app-settings';
import { useUnit } from 'effector-react';
import React, { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { $appDebugEnabled, setAppDebugEnabled } from '@model/app-debug';
import { $appSettings, fetchAppSettingsFx, updateAppSettings } from '@model/app-settings';
import { Drawer } from '@ui/drawer';
import { FormCheckbox, FormSelect } from '@ui/form-components';

type AppSettingsTab = 'general' | 'styles' | 'debug';
type ColorSchemeValue = 'light' | 'dark';

export const AppSettingsSidebar: React.FC = () => {
	const { t } = useTranslation();
	const [appSettings, appDebugEnabled] = useUnit([$appSettings, $appDebugEnabled]);
	const [activeTab, setActiveTab] = useState<AppSettingsTab>('general');
	const { colorScheme, setColorScheme } = useMantineColorScheme();
	const computedColorScheme = useComputedColorScheme('light');
	const selectedColorScheme: ColorSchemeValue = colorScheme === 'auto' ? computedColorScheme : colorScheme;
	const languageOptions = [
		{ value: 'ru', label: t('appSettings.languages.ru') },
		{ value: 'en', label: t('appSettings.languages.en') },
	];

	const methods = useForm<AppSettings>({
		defaultValues: appSettings,
	});

	useEffect(() => {
		const subscription = methods.watch((data) => {
			updateAppSettings(data);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [methods]);

	useEffect(() => {
		const unsubscribe = fetchAppSettingsFx.doneData.watch((data) => {
			methods.reset(data);
		});

		return () => {
			unsubscribe();
		};
	}, [methods]);

	return (
		<Drawer name="appSettings" title={t('appSettings.title')}>
			<FormProvider {...methods}>
				<Tabs value={activeTab} onChange={(v) => setActiveTab((v as AppSettingsTab) ?? 'general')} variant="outline">
					<Tabs.List mb="md">
						<Tabs.Tab value="general">{t('appSettings.tabs.general')}</Tabs.Tab>
						<Tabs.Tab value="styles">{t('appSettings.tabs.styles')}</Tabs.Tab>
						<Tabs.Tab value="debug">{t('appSettings.tabs.debug')}</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panel value="general">
						<Stack gap="lg">
							<Box>
								<Title order={4} mb="md">
									{t('appSettings.sections.general')}
								</Title>

								<Stack gap="md">
									<FormSelect
										name="language"
										label={t('appSettings.language.label')}
										selectProps={{
											options: languageOptions,
											allowDeselect: false,
											comboboxProps: { withinPortal: false },
										}}
									/>

									<FormCheckbox
										name="openLastChat"
										label={t('appSettings.openLastChat.label')}
										infoTip={t('appSettings.openLastChat.info')}
									/>

									<FormCheckbox
										name="autoSelectCurrentPersona"
										label={t('appSettings.autoSelectCurrentPersona.label')}
										infoTip={t('appSettings.autoSelectCurrentPersona.info')}
									/>
								</Stack>
							</Box>
						</Stack>
					</Tabs.Panel>

					<Tabs.Panel value="styles">
						<Stack gap="sm">
							<Text size="sm" fw={600}>
								{t('appSettings.styles.theme')}
							</Text>
							<SegmentedControl
								fullWidth
								value={selectedColorScheme}
								onChange={(value) => setColorScheme(value as ColorSchemeValue)}
								data={[
									{ label: t('appSettings.styles.light'), value: 'light' },
									{ label: t('appSettings.styles.dark'), value: 'dark' },
								]}
							/>
							<Text size="xs" c="dimmed">
								{t('appSettings.styles.description')}
							</Text>
						</Stack>
					</Tabs.Panel>

					<Tabs.Panel value="debug">
						<Stack gap="sm">
							<Checkbox
								checked={appDebugEnabled}
								onChange={(event) => setAppDebugEnabled(event.currentTarget.checked)}
								label={t('appSettings.debug.label')}
							/>
							<Text size="xs" c="dimmed">
								{t('appSettings.debug.info')}
							</Text>
						</Stack>
					</Tabs.Panel>
				</Tabs>
			</FormProvider>
		</Drawer>
	);
};
