import {
	ActionIcon,
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Group,
	PasswordInput,
	Select,
	SimpleGrid,
	Stack,
	Text,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuKeyRound } from 'react-icons/lu';

import type { AuthUser } from '../../api/auth';

type AccountUserRowProps = {
	user: AuthUser;
	allowEmptyPassword: boolean;
	pending: boolean;
	onUpdate: (params: { id: string; role?: AuthUser['role']; status?: AuthUser['status'] }) => void;
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
	const [opened, setOpened] = useState(false);
	const [newPassword, setNewPassword] = useState('');

	return (
		<Box
			p="sm"
			style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
		>
			<Group wrap="nowrap">
				<Avatar color="cyan" variant="light" radius="xl">
					{user.displayName.slice(0, 2).toLocaleUpperCase()}
				</Avatar>
				<Box style={{ flex: 1, minWidth: 0 }}>
					<Text fw={600} truncate>
						{user.displayName}
					</Text>
					<Text c="dimmed" size="sm" truncate>
						@{user.username}
					</Text>
				</Box>
				<Group gap={6} visibleFrom="xs">
					<Badge variant="light">{t(`auth.accounts.roles.${user.role}`)}</Badge>
					<Badge color={user.status === 'active' ? 'teal' : 'gray'} variant="light">
						{t(`auth.accounts.statuses.${user.status}`)}
					</Badge>
				</Group>
				<ActionIcon
					variant="subtle"
					aria-label={t('auth.accounts.manageUser', { name: user.displayName })}
					onClick={() => setOpened((value) => !value)}
				>
					<LuChevronDown
						size={18}
						style={{
							transform: opened ? 'rotate(180deg)' : undefined,
							transition: 'transform 140ms ease',
						}}
					/>
				</ActionIcon>
			</Group>

			<Collapse in={opened}>
				<Stack gap="md" pt="md">
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
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
					</SimpleGrid>
					<Group align="end" wrap="wrap">
						<PasswordInput
							label={t('auth.accounts.newPassword')}
							description={allowEmptyPassword ? t('auth.fields.passwordOptional') : undefined}
							leftSection={<LuKeyRound size={16} />}
							value={newPassword}
							disabled={pending}
							onChange={(event) => setNewPassword(event.currentTarget.value)}
							style={{ flex: '1 1 240px' }}
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
			</Collapse>
		</Box>
	);
}
