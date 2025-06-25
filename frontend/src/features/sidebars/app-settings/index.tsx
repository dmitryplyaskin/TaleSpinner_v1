import React, { useEffect } from 'react';
import { Box, Flex, Heading } from '@chakra-ui/react';
import { Drawer } from '@ui/drawer';
import { useUnit } from 'effector-react';
import { $appSettings, fetchAppSettingsFx, updateAppSettings } from '@model/app-settings';
import { FormCheckbox, FormSelect } from '@ui/form-components';
import { AppSettings } from '@shared/types/app-settings';
import { useForm, FormProvider } from 'react-hook-form';

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
				<Flex direction="column" gap={6}>
					<Box>
						<Heading size="md" mb={4}>
							Основные настройки
						</Heading>

						<Flex direction="column" gap={4}>
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
						</Flex>
					</Box>
				</Flex>
			</FormProvider>
		</Drawer>
	);
};
