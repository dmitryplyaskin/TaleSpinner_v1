import { Button, Group, PasswordInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	$authStatus,
	$authUsers,
	accountManagerOpened,
	createAuthUserFx,
	createUserSubmitted,
	logoutRequested,
} from '@model/auth';
import { Dialog } from '@ui/dialog';

export function AccountManager({ opened, onClose }: { opened: boolean; onClose: () => void }) {
	const { t } = useTranslation();
	const [status, users, load, create, logout, creating] = useUnit([
		$authStatus,
		$authUsers,
		accountManagerOpened,
		createUserSubmitted,
		logoutRequested,
		createAuthUserFx.pending,
	]);
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState<'admin' | 'user'>('user');

	useEffect(() => {
		if (opened && status.user?.role === 'admin') load();
	}, [load, opened, status.user?.role]);

	return (
		<Dialog
			open={opened}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t('auth.accounts.title')}
			size="md"
			footer={
				<Button color="red" variant="light" onClick={() => logout()}>
					{t('auth.accounts.logout')}
				</Button>
			}
		>
			<Stack>
				<Text>{t('auth.accounts.signedInAs', { name: status.user?.displayName })}</Text>
				{status.user?.role === 'admin' && (
					<>
						<Text fw={600}>{t('auth.accounts.users')}</Text>
						{users.map((user) => (
							<Text key={user.id} size="sm">
								{user.displayName} · {user.role}
							</Text>
						))}
						<TextInput label={t('auth.fields.username')} value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
						<TextInput label={t('auth.fields.displayName')} value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} />
						<PasswordInput
							label={t('auth.fields.password')}
							description={status.mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
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
						<Group justify="flex-end">
							<Button
								loading={creating}
								disabled={!username.trim()}
								onClick={() =>
									create({
										username,
										displayName: displayName || undefined,
										password,
										role,
									})
								}
							>
								{t('auth.accounts.create')}
							</Button>
						</Group>
					</>
				)}
			</Stack>
		</Dialog>
	);
}
