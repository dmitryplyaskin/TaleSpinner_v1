import { Box, Button, Flex, Text, VStack } from '@chakra-ui/react';
import { useUnit } from 'effector-react';

import { $isAgentSelected } from '@model/chat-service';
import { $appInitError, $appInitPending, $isAppReady, appStarted } from '@model/app-init';
import { Toaster } from '@ui/chakra-core-ui/toaster';

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
				<Flex h="100vh" align="center" justify="center" bg="gray.50" p={6}>
					<VStack gap={3} maxW="lg">
						<Text fontSize="lg" fontWeight="semibold">
							Загрузка приложения…
						</Text>
						{appInitError ? (
							<>
								<Text color="red.600" textAlign="center">
									{appInitError}
								</Text>
								<Button onClick={() => retryInit()} colorScheme="blue" loading={isAppInitPending}>
									Повторить
								</Button>
							</>
						) : (
							<Text color="gray.500" textAlign="center">
								Пожалуйста, подождите.
							</Text>
						)}
					</VStack>
				</Flex>
				<Toaster />
			</>
		);
	}

	return (
		<>
			<Flex h="100vh" overflow="hidden" bg="gray.50">
				<LeftBar />
				<Flex flex="1" direction="column" minW="0">
					<Box flex="1" overflow="hidden">
						{isAgentSelected ? (
							<ChatWindow />
						) : (
							<Flex h="100%" align="center" justify="center">
								<VStack gap={4}>
									<Text color="gray.500">Выберите существующий чат или создайте новый</Text>
									<Button
										onClick={() => agentCardsModel.createItemFx(createNewAgentCard())}
										colorScheme="blue"
										size="lg"
									>
										Создать новый чат
									</Button>
								</VStack>
							</Flex>
						)}
					</Box>
				</Flex>
			</Flex>

			<Toaster />
			<ConnectSidebars />
		</>
	);
}

export default App;
