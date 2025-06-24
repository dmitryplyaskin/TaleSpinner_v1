import React from 'react';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { Drawer } from '@ui/drawer';
import { useUnit } from 'effector-react';
import { $appSettings, updateAppSettings } from '@model/app-settings';
import { Switch } from '@ui/chakra-core-ui/switch';
import { Field } from '@ui/chakra-core-ui/field';
import { Select } from 'chakra-react-select';

const languageOptions = [
	{ value: 'ru', label: 'Русский' },
	{ value: 'en', label: 'English' },
];

export const AppSettingsSidebar: React.FC = () => {
	const appSettings = useUnit($appSettings);

	const handleLanguageChange = (details: { value: string[] }) => {
		if (details.value.length > 0) {
			updateAppSettings({ language: details.value[0] as 'ru' | 'en' });
		}
	};

	const handleOpenLastChatChange = (checked: boolean) => {
		updateAppSettings({ openLastChat: checked });
	};

	const handleAutoSelectPersonaChange = (checked: boolean) => {
		updateAppSettings({ autoSelectCurrentPersona: checked });
	};

	return (
		<Drawer name="appSettings" title="Настройки приложения">
			<Flex direction="column" gap={6}>
				<Box>
					<Heading size="md" mb={4}>
						Основные настройки
					</Heading>

					<Flex direction="column" gap={4}>
						{/* Language selector */}
						<Select
							placeholder="Сортировка..."
							options={languageOptions}
							value={languageOptions.find((option) => option.value === appSettings.language) || null}
							onChange={(selected) => handleLanguageChange({ value: [selected?.value || ''] })}
							menuPlacement="auto"
						/>

						{/* Open last chat switch */}
						<Field>
							<Flex justify="space-between" align="center">
								<Box>
									<Text fontWeight="medium">Открывать последний чат</Text>
									<Text fontSize="sm" color="gray.600">
										При запуске приложения автоматически открывать последний активный чат
									</Text>
								</Box>
								<Switch checked={appSettings.openLastChat} onCheckedChange={handleOpenLastChatChange} size="lg" />
							</Flex>
						</Field>

						{/* Auto select persona switch */}
						<Field>
							<Flex justify="space-between" align="center">
								<Box>
									<Text fontWeight="medium">Автовыбор персоны</Text>
									<Text fontSize="sm" color="gray.600">
										Автоматически выбирать актуальную персону в текущем чате
									</Text>
								</Box>
								<Switch
									checked={appSettings.autoSelectCurrentPersona}
									onCheckedChange={handleAutoSelectPersonaChange}
									size="lg"
								/>
							</Flex>
						</Field>
					</Flex>
				</Box>
			</Flex>
		</Drawer>
	);
};
