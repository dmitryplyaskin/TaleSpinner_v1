import { Box, Button, Flex, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import { $appInitError, $appInitPending, $isAppReady, appStarted } from '@model/app-init';
import { $currentEntityProfile, createEntityProfileFx } from '@model/chat-core';

import { ChatWindow } from './features/chat-window';
import { ConnectSidebars } from './features/sidebars/connect-sidebars';
import { LeftBar } from './features/sidebars/left-bar';

function App() {
	const { t } = useTranslation();
	const currentProfile = useUnit($currentEntityProfile);
	const [isAppReady, isAppInitPending, appInitError, retryInit] = useUnit([
		$isAppReady,
		$appInitPending,
		$appInitError,
		appStarted,
	]);

	if (!isAppReady) {
		return (
			<Flex h="100vh" align="center" justify="center" p="xl">
				<Stack gap="sm" maw={520} align="center">
					<Text size="lg" fw={600}>
						{t('app.loading')}
					</Text>
					{appInitError ? (
						<>
							<Text c="red" ta="center">
								{appInitError}
							</Text>
							<Button onClick={() => retryInit()} color="cyan" loading={isAppInitPending}>
								{t('app.retry')}
							</Button>
						</>
					) : (
						<Text c="dimmed" ta="center">
							{t('app.pleaseWait')}
						</Text>
					)}
				</Stack>
			</Flex>
		);
	}

	return (
		<>
			<Flex className="ts-app-shell">
				<LeftBar />
				<Flex className="ts-app-main" direction="column">
					<Box flex={1} style={{ overflow: 'hidden' }}>
						{currentProfile ? (
							<ChatWindow />
						) : (
							<Flex h="100%" align="center" justify="center">
								<Stack gap="md" align="center">
									<Text c="dimmed">{t('app.selectProfile')}</Text>
									<Button
										onClick={() => createEntityProfileFx({ name: `New profile ${new Date().toLocaleTimeString()}` })}
										color="cyan"
										size="lg"
									>
										{t('app.createProfile')}
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
