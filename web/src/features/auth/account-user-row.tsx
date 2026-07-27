import { Button, Group, Paper, PasswordInput, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AuthUser } from '../../api/auth';

type AccountUserRowProps = {
	user: AuthUser;
	allowEmptyPassword: boolean;
	pending: boolean;
	onUpdate: (params: {
		id: string;
		role?: AuthUser['role'];
		status?: AuthUser['status'];
	}) => void;
	onResetPassword: (params: { id: string; newPassword: string }) => void;
};

export function AccountUserRow({
	user,
	allowEmptyPassword,
	pending,
	onUpdate,
	onResetPassword,
}: AccountUserRowProps) {
	const { t } = useTranslation();
	const [newPassword, setNewPassword] = useState('');

	return (
		<Paper withBorder p="sm">
			<Stack gap="xs">
				<Text fw={500}>{user.displayName}</Text>
				<Text c="dimmed" size="xs">
					@{user.username}
				</Text>
				<Group grow align="end">
					<Select
						label={t('auth.accounts.role')}
						value={user.role}
						disabled={pending}
						onChange={(role) => {
							if (role === 'admin' || role === 'user') onUpdate({ id: user.id, role });
						}}
						data={[
							{ value: 'user', label: t('auth.accounts.roles.user') },
							{ value: 'admin', label: t('auth.accounts.roles.admin') },
						]}
					/>
					<Select
						label={t('auth.accounts.status')}
						value={user.status}
						disabled={pending}
						onChange={(status) => {
							if (status === 'active' || status === 'disabled') onUpdate({ id: user.id, status });
						}}
						data={[
							{ value: 'active', label: t('auth.accounts.statuses.active') },
							{ value: 'disabled', label: t('auth.accounts.statuses.disabled') },
						]}
					/>
				</Group>
				<Group align="end" wrap="nowrap">
					<PasswordInput
						label={t('auth.accounts.newPassword')}
						description={allowEmptyPassword ? t('auth.fields.passwordOptional') : undefined}
						value={newPassword}
						disabled={pending}
						onChange={(event) => setNewPassword(event.currentTarget.value)}
						style={{ flex: 1 }}
					/>
					<Button
						variant="light"
						loading={pending}
						disabled={!allowEmptyPassword && !newPassword}
						onClick={() => {
							onResetPassword({ id: user.id, newPassword });
							setNewPassword('');
						}}
					>
						{t('auth.accounts.resetPassword')}
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
}
