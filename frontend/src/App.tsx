import React, { useState, useEffect } from 'react';
import { ChatWindow } from './features/chat-window';
import { SettingsSidebar } from './features/settings-sidebar';
import { OpenRouterConfig, getOpenRouterConfig, updateOpenRouterConfig } from './features/api';
import { chatListModel } from './model/chat-list';
import { useUnit } from 'effector-react';
import { Box, Flex, Button, Text, VStack } from '@chakra-ui/react';

import { ChatCardSidebar } from './features/chat-card-sidebar';
import { UserPersonSidebar } from './features/user-person-sidebar';
import { LeftBar } from './left-bar';
import { Toaster } from '@ui/chakra-core-ui/toaster';
import './model/llm-orchestration';
import { PipelineSidebar } from './features/pipeline-sidebar';
import { $isAgentSelected } from '@model/chat-service';
import { InstructionsSidebar } from './features/instructions-sidebar';
import { TemplateSidebar } from './features/template-sidebar';
import { createNewAgentCard } from './utils/creation-helper-agent-card';

function App() {
	const isAgentSelected = useUnit($isAgentSelected);

	const [apiConfig, setApiConfig] = useState<OpenRouterConfig | null>(null);

	useEffect(() => {
		chatListModel.getItemsFx();
		getOpenRouterConfig().then(setApiConfig);
	}, []);

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
									<Button onClick={() => chatListModel.createItemFx(createNewAgentCard())} colorScheme="blue" size="lg">
										Создать новый чат
									</Button>
								</VStack>
							</Flex>
						)}
					</Box>
				</Flex>

				<SettingsSidebar
					onAPIConfigChange={async (config) => {
						await updateOpenRouterConfig(config);
						setApiConfig(config);
					}}
					apiConfig={apiConfig}
				/>
				<ChatCardSidebar />
				<UserPersonSidebar />
				<PipelineSidebar />
				<InstructionsSidebar />
				<TemplateSidebar />
			</Flex>

			<Toaster />
		</>
	);
}

export default App;
