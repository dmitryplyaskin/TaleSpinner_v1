import {
	Button,
	Center,
	Group,
	Loader,
} from '@mantine/core';
import { useUnit } from 'effector-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus } from 'react-icons/lu';

import { appStarted } from '@model/app-init';
import {
	$authError,
	$authInitialized,
	$authPending,
	$authStatus,
	authRetryRequested,
	authStarted,
	loginSubmitted,
	registerSubmitted,
	setupSubmitted,
} from '@model/auth';

import { AccountChooser } from './account-chooser';
import { AuthCredentialsForm } from './auth-credentials-form';
import { AuthWelcomeShell } from './auth-welcome-shell';

type AuthView = 'welcome' | 'login' | 'create';

export function AuthGate({ children }: { children: ReactNode }) {
	const { t } = useTranslation();
	const [status, initialized, pending, error, start, retry, setup, register, login] = useUnit([
		$authStatus,
		$authInitialized,
		$authPending,
		$authError,
		authStarted,
		authRetryRequested,
		setupSubmitted,
		registerSubmitted,
		loginSubmitted,
	]);
	const appStartedRef = useRef(false);
	const [view, setView] = useState<AuthView>('welcome');

	useEffect(() => start(), [start]);
	useEffect(() => setView('welcome'), [status.mode, status.setupRequired]);
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

	const hasLocalAccounts = status.mode === 'local' && status.accounts.length > 0;
	const title = hasLocalAccounts
		? t('auth.chooser.title')
		: status.setupRequired
			? t('auth.welcome.emptyTitle')
			: t('auth.welcome.title');

	return (
		<AuthWelcomeShell
			mode={status.mode}
			title={title}
			description={
				hasLocalAccounts
					? t('auth.chooser.description')
					: t(
							status.setupRequired
								? `auth.welcome.emptyDescription.${status.mode}`
								: `auth.welcome.description.${status.mode}`,
						)
			}
			error={error}
			onRetry={retry}
		>
			{view === 'welcome' && hasLocalAccounts && (
				<>
					<AccountChooser accounts={status.accounts} pending={pending} onSelect={login} />
					{status.registrationAllowed && (
						<Button
							variant="subtle"
							leftSection={<LuPlus size={17} />}
							onClick={() => setView('create')}
						>
							{t('auth.register.open')}
						</Button>
					)}
				</>
			)}

			{view === 'welcome' && !hasLocalAccounts && (
				<Group grow>
					{!status.setupRequired && (
						<Button onClick={() => setView('login')}>{t('auth.login.open')}</Button>
					)}
					{(status.setupRequired || status.registrationAllowed) && (
						<Button
							variant={status.setupRequired ? 'filled' : 'light'}
							leftSection={<LuPlus size={17} />}
							onClick={() => setView('create')}
						>
							{status.setupRequired ? t('auth.setup.open') : t('auth.register.open')}
						</Button>
					)}
				</Group>
			)}

			{view === 'login' && (
				<AuthCredentialsForm
					kind="login"
					mode={status.mode}
					pending={pending}
					onCancel={() => setView('welcome')}
					onLogin={login}
				/>
			)}

			{view === 'create' && (
				<AuthCredentialsForm
					kind="create"
					mode={status.mode}
					firstAccount={status.setupRequired}
					pending={pending}
					onCancel={() => setView('welcome')}
					onCreate={(values) =>
						status.setupRequired
							? setup(values)
							: register({
									username: values.username,
									displayName: values.displayName,
									password: values.password,
								})
					}
				/>
			)}
		</AuthWelcomeShell>
	);
}
