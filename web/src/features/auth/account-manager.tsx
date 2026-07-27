import { Button, Group, PasswordInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	$authStatus,
	$authError,
	$authUsers,
	accountManagerOpened,
	changeOwnPasswordFx,
	createAuthUserFx,
	createUserSubmitted,
	logoutRequested,
	ownPasswordChangeSubmitted,
	resetAuthUserPasswordFx,
	updateAuthUserFx,
	userAdministrationSubmitted,
	userPasswordResetSubmitted,
} from '@model/auth';
import { Dialog } from '@ui/dialog';

import { AccountUserRow } from './account-user-row';

export function AccountManager({ opened, onClose }: { opened: boolean; onClose: () => void }) {
	const { t } = useTranslation();
	const [
		status,
		users,
		error,
		load,
		create,
		updateUser,
		resetUserPassword,
		changePassword,
		logout,
		creating,
		updating,
		resetting,
		changingPassword,
	] = useUnit([
		$authStatus,
		$authUsers,
		$authError,
		accountManagerOpened,
		createUserSubmitted,
		userAdministrationSubmitted,
		userPasswordResetSubmitted,
		ownPasswordChangeSubmitted,
		logoutRequested,
		createAuthUserFx.pending,
		updateAuthUserFx.pending,
		resetAuthUserPasswordFx.pending,
		changeOwnPasswordFx.pending,
	]);
	const [username, setUsername] = useState('');
	const [displayName, setDisplayName] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState<'admin' | 'user'>('user');
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');

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
				<Text fw={600}>{t('auth.accounts.changeOwnPassword')}</Text>
				<PasswordInput
					label={t('auth.accounts.currentPassword')}
					value={currentPassword}
					onChange={(event) => setCurrentPassword(event.currentTarget.value)}
				/>
				<PasswordInput
					label={t('auth.accounts.newPassword')}
					description={status.mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
					value={newPassword}
					onChange={(event) => setNewPassword(event.currentTarget.value)}
				/>
				<Group justify="flex-end">
					<Button
						variant="light"
						loading={changingPassword}
						disabled={status.mode === 'public' && !newPassword}
						onClick={() => changePassword({ currentPassword, newPassword })}
					>
						{t('auth.accounts.changePassword')}
					</Button>
				</Group>
				{error && <Text c="red">{error}</Text>}
				{status.user?.role === 'admin' && (
					<>
						<Text fw={600}>{t('auth.accounts.users')}</Text>
						{users.map((user) => (
							<AccountUserRow
								key={user.id}
								user={user}
								allowEmptyPassword={status.mode === 'local'}
								pending={updating || resetting}
								onUpdate={updateUser}
								onResetPassword={resetUserPassword}
							/>
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
