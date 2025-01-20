import React, { useState, useEffect } from 'react';
import { ChatWindow } from './components/chat-window';
// import { SettingsSidebar } from './components/settings-sidebar';
import { OpenRouterConfig, getOpenRouterConfig, updateOpenRouterConfig } from './components/api';
import { $currentChat, createChatFx, getChatListFx } from './model';
import { useUnit } from 'effector-react';
import { Box, Flex, Button, Text, VStack } from '@chakra-ui/react';

import { ChatCardSidebar } from './components/chat-card-sidebar';
// import { UserPersonSidebar } from './components/user-person-sidebar';
import { LeftBar } from './left-bar';

interface LLMSettings {
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

function App() {
	const chat = useUnit($currentChat);

	const [llmSettings, setLlmSettings] = useState<LLMSettings>({
		temperature: 0.7,
		maxTokens: 2000,
		topP: 1,
		frequencyPenalty: 0,
		presencePenalty: 0,
	});
	const [apiConfig, setApiConfig] = useState<OpenRouterConfig | null>(null);

	useEffect(() => {
		getChatListFx();
		getOpenRouterConfig().then(setApiConfig);
	}, []);

	return (
		<Flex h="100vh" overflow="hidden" bg="gray.50">
			<LeftBar />
			<Flex flex="1" direction="column" minW="0">
				<Box flex="1" overflow="hidden">
					{chat ? (
						<ChatWindow settings={llmSettings} />
					) : (
						<Flex h="100%" align="center" justify="center">
							<VStack spacing={4}>
								<Text color="gray.500">Выберите существующий чат или создайте новый</Text>
								<Button onClick={createChatFx} colorScheme="blue" size="lg">
									Создать новый чат
								</Button>
							</VStack>
						</Flex>
					)}
				</Box>
			</Flex>

			{/* <SettingsSidebar
				onLLMSettingsChange={setLlmSettings}
				onAPIConfigChange={async (config) => {
					await updateOpenRouterConfig(config);
					setApiConfig(config);
				}}
				apiConfig={apiConfig}
			/> */}
			<ChatCardSidebar />
			{/* <UserPersonSidebar /> */}
		</Flex>
	);
}

export default App;
