import { Box, Button, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { KeyIcon } from '@ui/icons';

import type { AuthStatus } from '../../api/auth';

type AccountSecuritySectionProps = {
	status: AuthStatus;
	pending: boolean;
	onChangePassword: (params: { currentPassword: string; newPassword: string }) => void;
};

export function AccountSecuritySection({
	status,
	pending,
	onChangePassword,
}: AccountSecuritySectionProps) {
	const { t } = useTranslation();
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const hasPassword = status.user?.hasPassword ?? false;

	const submit = (event: FormEvent) => {
		event.preventDefault();
		onChangePassword({ currentPassword, newPassword });
	};

	return (
		<Box component="form" onSubmit={submit}>
			<Stack gap="lg">
				<Box>
					<Text fw={650}>{t('auth.accounts.changeOwnPassword')}</Text>
					<Text size="sm" c="dimmed">
						{t(`auth.accounts.passwordDescription.${status.mode}`)}
					</Text>
				</Box>
				{hasPassword && (
					<PasswordInput
						label={t('auth.accounts.currentPassword')}
						leftSection={<KeyIcon size={16} />}
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.currentTarget.value)}
						autoComplete="current-password"
					/>
				)}
				<PasswordInput
					label={t('auth.accounts.newPassword')}
					description={status.mode === 'local' ? t('auth.fields.passwordOptional') : undefined}
					leftSection={<KeyIcon size={16} />}
					value={newPassword}
					onChange={(event) => setNewPassword(event.currentTarget.value)}
					autoComplete="new-password"
				/>
				<Group justify="flex-end">
					<Button
						type="submit"
						loading={pending}
						disabled={
							(status.mode === 'public' && !newPassword) ||
							(hasPassword && !currentPassword)
						}
					>
						{t('auth.accounts.changePassword')}
					</Button>
				</Group>
			</Stack>
		</Box>
	);
}
