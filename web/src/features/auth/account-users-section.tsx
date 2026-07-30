import {
	Box,
	Button,
	Collapse,
	Group,
	Loader,
	PasswordInput,
	Select,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PlusIcon, UsersIcon } from '@ui/icons';

import { AccountUserRow } from './account-user-row';

import type { AccessMode, AuthUser } from '../../api/auth';

type AccountUsersSectionProps = {
	mode: AccessMode;
	users: AuthUser[];
	loading: boolean;
	mutating: boolean;
	onCreate: (params: {
		username: string;
		displayName?: string;
		password: string;
		role: AuthUser['role'];
	}) => void;
	onUpdate: (params: { id: string; role?: AuthUser['role']; status?: AuthUser['status'] }) => void;
	onResetPassword: (params: { id: string; newPassword: string }) => void;
};

export function AccountUsersSection({
	mode,
	users,
	loading,
	mutating,
	onCreate,
	onUpdate,
	onResetPassword,
}: AccountUsersSectionProps) {
	const { t } = useTranslation();
	const [creating, setCreating] = useState(false);
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState<AuthUser['role']>('user');

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!username.trim()) return;
		onCreate({
			username,
			displayName: displayName || undefined,
			password,
			role,
		});
	};

	return (
		<Stack gap="lg">
			<Group justify="space-between" align="flex-start">
				<Box>
					<Group gap="xs">
						<UsersIcon size={18} />
						<Text fw={650}>{t('auth.accounts.users')}</Text>
					</Group>
					<Text size="sm" c="dimmed">
						{t('auth.accounts.usersDescription', { count: users.length })}
					</Text>
				</Box>
				<Button
					variant={creating ? 'subtle' : 'light'}
					leftSection={<PlusIcon size={17} />}
					onClick={() => setCreating((value) => !value)}
				>
					{creating ? t('common.cancel') : t('auth.accounts.create')}
				</Button>
			</Group>

			<Collapse expanded={creating}>
				<Box
					component="form"
					onSubmit={submit}
					p="md"
					style={{
						border: '1px solid var(--mantine-color-default-border)',
						borderRadius: 'var(--mantine-radius-md)',
						background: 'var(--mantine-color-default-hover)',
					}}
				>
					<Stack gap="md">
						<Text fw={600}>{t('auth.accounts.createTitle')}</Text>
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput
								label={t('auth.fields.username')}
								value={username}
								onChange={(event) => setUsername(event.currentTarget.value)}
								autoComplete="off"
							/>
							<TextInput
								label={t('auth.fields.displayName')}
								value={displayName}
								onChange={(event) => setDisplayName(event.currentTarget.value)}
							/>
							<PasswordInput
								label={t('auth.fields.password')}
								description={mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
								value={password}
								onChange={(event) => setPassword(event.currentTarget.value)}
								autoComplete="new-password"
							/>
							<Select
								label={t('auth.accounts.role')}
								value={role}
								onChange={(value) => setRole(value === 'admin' ? 'admin' : 'user')}
								data={[
									{ value: 'user', label: t('auth.accounts.roles.user') },
									{ value: 'admin', label: t('auth.accounts.roles.admin') },
								]}
							/>
						</SimpleGrid>
						<Group justify="flex-end">
							<Button
								type="submit"
								loading={mutating}
								disabled={!username.trim() || (mode === 'public' && !password)}
							>
								{t('auth.accounts.create')}
							</Button>
						</Group>
					</Stack>
				</Box>
			</Collapse>

			{loading && (
				<Group justify="center" py="xl">
					<Loader size="sm" aria-label={t('auth.accounts.loadingUsers')} />
				</Group>
			)}
			{!loading && (
				<Box
					style={{
						border: '1px solid var(--mantine-color-default-border)',
						borderRadius: 'var(--mantine-radius-md)',
						overflow: 'hidden',
					}}
				>
					{users.map((user) => (
						<AccountUserRow
							key={user.id}
							user={user}
							allowEmptyPassword={mode === 'local'}
							pending={mutating}
							onUpdate={onUpdate}
							onResetPassword={onResetPassword}
						/>
					))}
				</Box>
			)}
		</Stack>
	);
}
