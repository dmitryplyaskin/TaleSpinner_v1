import {
	Avatar,
	Badge,
	Box,
	Button,
	Divider,
	Group,
	Stack,
	Text,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLogOut, LuRefreshCw } from 'react-icons/lu';

import { AccountChooser } from './account-chooser';
import { AuthCredentialsForm } from './auth-credentials-form';

import type { AuthStatus } from '../../api/auth';

type AccountOverviewSectionProps = {
	status: AuthStatus;
	pending: boolean;
	onSwitch: (params: { username?: string; userId?: string; password: string }) => void;
	onLogout: () => void;
};

export function AccountOverviewSection({
	status,
	pending,
	onSwitch,
	onLogout,
}: AccountOverviewSectionProps) {
	const { t } = useTranslation();
	const [manualSwitch, setManualSwitch] = useState(false);
	const currentUser = status.user;
	if (!currentUser) return null;

	const otherLocalAccounts = status.accounts.filter((account) => account.id !== currentUser.id);

	return (
		<Stack gap="lg">
			<Group wrap="nowrap">
				<Avatar size={52} radius="xl" color="cyan" variant="light">
					{currentUser.displayName.slice(0, 2).toLocaleUpperCase()}
				</Avatar>
				<Box style={{ flex: 1, minWidth: 0 }}>
					<Text fw={700} size="lg" truncate>
						{currentUser.displayName}
					</Text>
					<Text c="dimmed" size="sm" truncate>
						@{currentUser.username}
					</Text>
				</Box>
				<Badge variant="light">{t(`auth.accounts.roles.${currentUser.role}`)}</Badge>
			</Group>

			<Divider />

			<Box>
				<Text fw={650}>{t('auth.accounts.switchTitle')}</Text>
				<Text size="sm" c="dimmed" mb="md">
					{t(`auth.accounts.switchDescription.${status.mode}`)}
				</Text>

				{status.mode === 'local' && otherLocalAccounts.length > 0 && (
					<AccountChooser
						accounts={status.accounts}
						currentUserId={currentUser.id}
						pending={pending}
						onSelect={onSwitch}
					/>
				)}
				{status.mode === 'local' && otherLocalAccounts.length === 0 && (
					<Text size="sm" c="dimmed">
						{t('auth.accounts.noOtherAccounts')}
					</Text>
				)}
				{status.mode === 'public' && !manualSwitch && (
					<Button
						variant="light"
						leftSection={<LuRefreshCw size={17} />}
						onClick={() => setManualSwitch(true)}
					>
						{t('auth.accounts.switchAction')}
					</Button>
				)}
				{status.mode === 'public' && manualSwitch && (
					<AuthCredentialsForm
						kind="login"
						mode="public"
						pending={pending}
						onCancel={() => setManualSwitch(false)}
						onLogin={onSwitch}
					/>
				)}
			</Box>

			<Divider />

			<Group justify="space-between">
				<Box>
					<Text fw={600}>{t('auth.accounts.endSession')}</Text>
					<Text size="sm" c="dimmed">
						{t('auth.accounts.endSessionDescription')}
					</Text>
				</Box>
				<Button
					color="red"
					variant="subtle"
					leftSection={<LuLogOut size={17} />}
					loading={pending}
					onClick={onLogout}
				>
					{t('auth.accounts.logout')}
				</Button>
			</Group>
		</Stack>
	);
}
