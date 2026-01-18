import { Box, Stack, Title } from '@mantine/core';
import { type AppSettings } from '@shared/types/app-settings';
import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import { $appSettings, fetchAppSettingsFx, updateAppSettings } from '@model/app-settings';
import { Drawer } from '@ui/drawer';
import { FormCheckbox, FormSelect } from '@ui/form-components';


const languageOptions = [
	{ value: 'ru', label: 'Русский' },
	{ value: 'en', label: 'English' },
];

export const AppSettingsSidebar: React.FC = () => {
	const appSettings = useUnit($appSettings);

	const methods = useForm<AppSettings>({
		defaultValues: appSettings,
	});

	useEffect(() => {
		methods.watch((data) => {
			updateAppSettings(data);
		});
	}, [methods]);

	useEffect(() => {
		const unsubscribe = fetchAppSettingsFx.done.watch((data) => {
			methods.reset(data.result);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	return (
		<Drawer name="appSettings" title="Настройки приложения">
			<FormProvider {...methods}>
				<Stack gap="lg">
					<Box>
						<Title order={4} mb="md">
							Основные настройки
						</Title>

						<Stack gap="md">
							{/* Language selector */}
							<FormSelect
								name="language"
								label="Язык"
								selectProps={{
									options: languageOptions,
									menuPlacement: 'auto',
								}}
							/>

							<FormCheckbox
								name="openLastChat"
								label="Открывать последний чат"
								infoTip="При запуске приложения автоматически открывать последний активный чат"
							/>

							<FormCheckbox
								name="autoSelectCurrentPersona"
								label="Автовыбор персоны"
								infoTip="Автоматически выбирать актуальную персону в текущем чате"
							/>
						</Stack>
					</Box>
				</Stack>
			</FormProvider>
		</Drawer>
	);
};
