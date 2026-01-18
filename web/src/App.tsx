import { Box, Button, Flex, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';

import { $isAgentSelected } from '@model/chat-service';
import { $appInitError, $appInitPending, $isAppReady, appStarted } from '@model/app-init';

import { ChatWindow } from './features/chat-window';
import { ConnectSidebars } from './features/sidebars/connect-sidebars';
import { LeftBar } from './features/sidebars/left-bar';
import { agentCardsModel } from './model/agent-cards';
import './model/llm-orchestration';
import { createNewAgentCard } from './utils/creation-helper-agent-card';

function App() {
	const isAgentSelected = useUnit($isAgentSelected);
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
						{isAgentSelected ? (
							<ChatWindow />
						) : (
							<Flex h="100%" align="center" justify="center">
								<Stack gap="md" align="center">
									<Text c="dimmed">Выберите существующий чат или создайте новый</Text>
									<Button
										onClick={() => agentCardsModel.createItemFx(createNewAgentCard())}
										color="blue"
										size="lg"
									>
										Создать новый чат
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
