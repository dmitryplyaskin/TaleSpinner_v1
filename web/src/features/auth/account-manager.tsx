import { Alert, Button, Tabs } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCircleAlert, LuKeyRound, LuShield, LuUserRound } from 'react-icons/lu';

import {
	$authError,
	$authStatus,
	$authUsers,
	accountManagerOpened,
	changeOwnPasswordFx,
	createAuthUserFx,
	createUserSubmitted,
	loadAuthUsersFx,
	logoutAccountFx,
	logoutRequested,
	ownPasswordChangeSubmitted,
	resetAuthUserPasswordFx,
	switchAccountFx,
	switchAccountSubmitted,
	updateAuthUserFx,
	userAdministrationSubmitted,
	userPasswordResetSubmitted,
} from '@model/auth';
import { Dialog } from '@ui/dialog';

import { AccountOverviewSection } from './account-overview-section';
import { AccountSecuritySection } from './account-security-section';
import { AccountUsersSection } from './account-users-section';

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
		switchUser,
		logout,
		loadingUsers,
		creating,
		updating,
		resetting,
		changingPassword,
		switching,
		loggingOut,
	] = useUnit([
		$authStatus,
		$authUsers,
		$authError,
		accountManagerOpened,
		createUserSubmitted,
		userAdministrationSubmitted,
		userPasswordResetSubmitted,
		ownPasswordChangeSubmitted,
		switchAccountSubmitted,
		logoutRequested,
		loadAuthUsersFx.pending,
		createAuthUserFx.pending,
		updateAuthUserFx.pending,
		resetAuthUserPasswordFx.pending,
		changeOwnPasswordFx.pending,
		switchAccountFx.pending,
		logoutAccountFx.pending,
	]);

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
			size="lg"
			footer={
				<Button variant="subtle" onClick={onClose}>
					{t('common.close')}
				</Button>
			}
		>
			{error && (
				<Alert color="red" variant="light" icon={<LuCircleAlert size={18} />}>
					{error}
				</Alert>
			)}
			<Tabs defaultValue="account" keepMounted={false}>
				<Tabs.List grow mb="lg">
					<Tabs.Tab value="account" leftSection={<LuUserRound size={16} />}>
						{t('auth.accounts.tabs.account')}
					</Tabs.Tab>
					<Tabs.Tab value="security" leftSection={<LuKeyRound size={16} />}>
						{t('auth.accounts.tabs.security')}
					</Tabs.Tab>
					{status.user?.role === 'admin' && (
						<Tabs.Tab value="users" leftSection={<LuShield size={16} />}>
							{t('auth.accounts.tabs.users')}
						</Tabs.Tab>
					)}
				</Tabs.List>

				<Tabs.Panel value="account">
					<AccountOverviewSection
						status={status}
						pending={switching || loggingOut}
						onSwitch={switchUser}
						onLogout={logout}
					/>
				</Tabs.Panel>
				<Tabs.Panel value="security">
					<AccountSecuritySection
						status={status}
						pending={changingPassword}
						onChangePassword={changePassword}
					/>
				</Tabs.Panel>
				{status.user?.role === 'admin' && (
					<Tabs.Panel value="users">
						<AccountUsersSection
							mode={status.mode}
							users={users}
							loading={loadingUsers}
							mutating={creating || updating || resetting}
							onCreate={create}
							onUpdate={updateUser}
							onResetPassword={resetUserPassword}
						/>
					</Tabs.Panel>
				)}
			</Tabs>
		</Dialog>
	);
}
