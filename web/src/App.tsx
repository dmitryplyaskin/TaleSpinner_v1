import { Box, Button, Flex, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';

import { $currentEntityProfile, createEntityProfileFx } from '@model/chat-core';
import { $appInitError, $appInitPending, $isAppReady, appStarted } from '@model/app-init';

import { ChatWindow } from './features/chat-window';
import { ConnectSidebars } from './features/sidebars/connect-sidebars';
import { LeftBar } from './features/sidebars/left-bar';

function App() {
	const currentProfile = useUnit($currentEntityProfile);
	const [isAppReady, isAppInitPending, appInitError, retryInit] = useUnit([
		$isAppReady,
		$appInitPending,
		$appInitError,
		appStarted,
	]);

	if (!isAppReady) {
		return (
			<>
				<Flex h="100vh" align="center" justify="center" bg="var(--mantine-color-gray-0)" p="xl">
					<Stack gap="sm" maw={520} align="center">
						<Text size="lg" fw={600}>
							Загрузка приложения…
						</Text>
						{appInitError ? (
							<>
								<Text c="red" ta="center">
									{appInitError}
								</Text>
								<Button onClick={() => retryInit()} color="blue" loading={isAppInitPending}>
									Повторить
								</Button>
							</>
						) : (
							<Text c="dimmed" ta="center">
								Пожалуйста, подождите.
							</Text>
						)}
					</Stack>
				</Flex>
			</>
		);
	}

	return (
		<>
			<Flex h="100vh" style={{ overflow: 'hidden' }} bg="var(--mantine-color-gray-0)">
				<LeftBar />
				<Flex flex={1} direction="column" miw={0}>
					<Box flex={1} style={{ overflow: 'hidden' }}>
						{currentProfile ? (
							<ChatWindow />
						) : (
							<Flex h="100%" align="center" justify="center">
								<Stack gap="md" align="center">
									<Text c="dimmed">Выберите Entity Profile или создайте новый</Text>
									<Button
										onClick={() => createEntityProfileFx({ name: `New profile ${new Date().toLocaleTimeString()}` })}
										color="blue"
										size="lg"
									>
										Создать новый профиль
									</Button>
								</Stack>
							</Flex>
						)}
					</Box>
				</Flex>
			</Flex>

			<ConnectSidebars />
		</>
	);
}

export default App;
