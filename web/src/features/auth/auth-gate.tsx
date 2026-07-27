import { Button, Center, Loader, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useUnit } from 'effector-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appStarted } from '@model/app-init';
import {
	$authError,
	$authInitialized,
	$authPending,
	$authStatus,
	authRetryRequested,
	authStarted,
	loginSubmitted,
	setupSubmitted,
} from '@model/auth';

export function AuthGate({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [status, initialized, pending, error, start, retry, setup, login] = useUnit([
		$authStatus,
		$authInitialized,
		$authPending,
		$authError,
		authStarted,
		authRetryRequested,
		setupSubmitted,
		loginSubmitted,
	]);
	const appStartedRef = useRef(false);
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [setupToken, setSetupToken] = useState('');

	useEffect(() => start(), [start]);
	useEffect(() => {
		if (!status.authenticated) {
			appStartedRef.current = false;
			return;
		}
		if (appStartedRef.current) return;
		appStartedRef.current = true;
		appStarted();
	}, [status.authenticated]);

	if (!initialized) {
		return (
			<Center mih="100vh">
				<Loader aria-label={t('auth.loading')} />
			</Center>
		);
	}

	if (status.authenticated) return <>{children}</>;

	const submitSetup = () =>
		setup({
			username,
			displayName: displayName || undefined,
			password,
			setupToken: setupToken || undefined,
		});
	const submitLogin = () => login({ username, password });

	return (
		<Center mih="100vh" p="md">
			<Paper withBorder shadow="md" radius="md" p="xl" w="100%" maw={440}>
				<Stack>
					<Title order={2}>{status.setupRequired ? t('auth.setup.title') : t('auth.login.title')}</Title>
					<Text c="dimmed">
						{status.setupRequired
							? t(`auth.setup.description.${status.mode}`)
							: t(`auth.login.description.${status.mode}`)}
					</Text>

					{!status.setupRequired && status.mode === 'local' && status.accounts.length > 0 && (
						<Stack gap="xs">
							{status.accounts.map((account) => (
								<Button
									key={account.id}
									variant="light"
									loading={pending}
									onClick={() =>
										account.hasPassword
											? setUsername(account.username)
											: login({ userId: account.id, password: '' })
									}
								>
									{account.displayName}
								</Button>
							))}
						</Stack>
					)}

					<TextInput
						label={t('auth.fields.username')}
						value={username}
						onChange={(event) => setUsername(event.currentTarget.value)}
						autoComplete="username"
					/>
					{status.setupRequired && (
						<TextInput
							label={t('auth.fields.displayName')}
							value={displayName}
							onChange={(event) => setDisplayName(event.currentTarget.value)}
						/>
					)}
					<PasswordInput
						label={t('auth.fields.password')}
						description={status.mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
						value={password}
						onChange={(event) => setPassword(event.currentTarget.value)}
						autoComplete={status.setupRequired ? 'new-password' : 'current-password'}
					/>
					{status.setupRequired && status.mode === 'public' && (
						<PasswordInput
							label={t('auth.fields.setupToken')}
							value={setupToken}
							onChange={(event) => setSetupToken(event.currentTarget.value)}
						/>
					)}
					{error && <Text c="red">{error}</Text>}
					<Button
						loading={pending}
						disabled={!username.trim()}
						onClick={status.setupRequired ? submitSetup : submitLogin}
					>
						{status.setupRequired ? t('auth.setup.submit') : t('auth.login.submit')}
					</Button>
					{error && (
						<Button variant="subtle" onClick={() => retry()}>
							{t('auth.retry')}
						</Button>
					)}
				</Stack>
			</Paper>
		</Center>
	);
}
