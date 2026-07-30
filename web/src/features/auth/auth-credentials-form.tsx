import { Box, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccessMode } from '../../api/auth';

type CreateValues = {
	username: string;
	displayName?: string;
	password: string;
	setupToken?: string;
};

type AuthCredentialsFormProps =
	| {
			kind: 'login';
			mode: AccessMode;
			pending: boolean;
			onCancel: () => void;
			onLogin: (params: { username: string; password: string }) => void;
	  }
	| {
			kind: 'create';
			mode: AccessMode;
			firstAccount: boolean;
			pending: boolean;
			onCancel: () => void;
			onCreate: (params: CreateValues) => void;
	  };

export function AuthCredentialsForm(props: AuthCredentialsFormProps) {
	const { t } = useTranslation();
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [setupToken, setSetupToken] = useState('');

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!username.trim()) return;
		if (props.kind === 'login') {
			props.onLogin({ username, password });
			return;
		}
		props.onCreate({
			username,
			displayName: displayName || undefined,
			password,
			setupToken: setupToken || undefined,
		});
	};

	return (
		<Box component="form" onSubmit={submit}>
			<Stack gap="md">
				<Box>
					<Text fw={650}>
						{props.kind === 'login'
							? t('auth.login.formTitle')
							: t(props.firstAccount ? 'auth.setup.formTitle' : 'auth.register.formTitle')}
					</Text>
					<Text size="sm" c="dimmed">
						{props.kind === 'login'
							? t(`auth.login.description.${props.mode}`)
							: t(
									props.firstAccount
										? `auth.setup.description.${props.mode}`
										: `auth.register.description.${props.mode}`,
								)}
					</Text>
				</Box>
				<TextInput
					label={t('auth.fields.username')}
					value={username}
					onChange={(event) => setUsername(event.currentTarget.value)}
					autoComplete="username"
					autoFocus
				/>
				{props.kind === 'create' && (
					<TextInput
						label={t('auth.fields.displayName')}
						value={displayName}
						onChange={(event) => setDisplayName(event.currentTarget.value)}
					/>
				)}
				<PasswordInput
					label={t('auth.fields.password')}
					description={props.mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
					value={password}
					onChange={(event) => setPassword(event.currentTarget.value)}
					autoComplete={props.kind === 'create' ? 'new-password' : 'current-password'}
				/>
				{props.kind === 'create' && props.firstAccount && props.mode === 'public' && (
					<PasswordInput
						label={t('auth.fields.setupToken')}
						value={setupToken}
						onChange={(event) => setSetupToken(event.currentTarget.value)}
						autoComplete="off"
					/>
				)}
				<Group justify="flex-end">
					<Button variant="subtle" onClick={props.onCancel} disabled={props.pending}>
						{t('common.cancel')}
					</Button>
					<Button
						type="submit"
						loading={props.pending}
						disabled={
							!username.trim() ||
							(props.mode === 'public' && !password) ||
							(props.kind === 'create' &&
								props.firstAccount &&
								props.mode === 'public' &&
								!setupToken)
						}
					>
						{props.kind === 'login'
							? t('auth.login.submit')
							: t(props.firstAccount ? 'auth.setup.submit' : 'auth.register.submit')}
					</Button>
				</Group>
			</Stack>
		</Box>
	);
}
