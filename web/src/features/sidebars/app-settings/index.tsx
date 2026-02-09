import { Box, Stack, Title } from '@mantine/core';
import { type AppSettings } from '@shared/types/app-settings';
import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { $appSettings, fetchAppSettingsFx, updateAppSettings } from '@model/app-settings';
import { Drawer } from '@ui/drawer';
import { FormCheckbox, FormSelect } from '@ui/form-components';

export const AppSettingsSidebar: React.FC = () => {
	const { t } = useTranslation();
	const appSettings = useUnit($appSettings);
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
				<Stack gap="lg">
					<Box>
						<Title order={4} mb="md">
							{t('appSettings.sections.general')}
						</Title>

						<Stack gap="md">
							{/* Language selector */}
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
			</FormProvider>
		</Drawer>
	);
};
