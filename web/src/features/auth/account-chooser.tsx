import {
	Avatar,
	Badge,
	Box,
	Button,
	Collapse,
	Group,
	PasswordInput,
	Stack,
	Text,
	UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuChevronRight, LuKeyRound } from 'react-icons/lu';

import type { AuthUser } from '../../api/auth';

type AccountChooserProps = {
	accounts: AuthUser[];
	currentUserId?: string;
	pending: boolean;
	onSelect: (params: { userId: string; password: string }) => void;
};

function getInitials(name: string): string {
	return name
		.split(/\s+/)
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toLocaleUpperCase();
}

export function AccountChooser({
	accounts,
	currentUserId,
	pending,
	onSelect,
}: AccountChooserProps) {
	const { t } = useTranslation();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [password, setPassword] = useState('');

	const chooseAccount = (account: AuthUser) => {
		if (account.id === currentUserId) return;
		if (!account.hasPassword) {
			onSelect({ userId: account.id, password: '' });
			return;
		}
		setPassword('');
		setSelectedId(account.id);
	};

	return (
		<Stack gap="xs">
			{accounts.map((account) => {
				const current = account.id === currentUserId;
				const selected = account.id === selectedId;
				return (
					<Box
						key={account.id}
						style={{
							border: `1px solid ${selected ? 'var(--mantine-color-cyan-6)' : 'var(--mantine-color-default-border)'}`,
							borderRadius: 'var(--mantine-radius-md)',
							overflow: 'hidden',
							transition: 'border-color 140ms ease, background-color 140ms ease',
						}}
					>
						<UnstyledButton
							w="100%"
							p="sm"
							disabled={current || pending}
							aria-label={t('auth.chooser.openAccount', { name: account.displayName })}
							onClick={() => chooseAccount(account)}
							style={{
								background: selected ? 'var(--mantine-color-cyan-light)' : 'var(--mantine-color-body)',
								cursor: current ? 'default' : 'pointer',
							}}
						>
							<Group wrap="nowrap">
								<Avatar color="cyan" variant="light" radius="xl">
									{getInitials(account.displayName)}
								</Avatar>
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Group gap="xs">
										<Text fw={600} truncate>
											{account.displayName}
										</Text>
										{current && (
											<Badge size="xs" variant="light" leftSection={<LuCheck size={11} />}>
												{t('auth.chooser.current')}
											</Badge>
										)}
									</Group>
									<Text size="sm" c="dimmed" truncate>
										@{account.username}
									</Text>
								</Box>
								{account.hasPassword ? (
									<LuKeyRound
										size={17}
										aria-label={t('auth.chooser.passwordProtected')}
										color="var(--mantine-color-dimmed)"
									/>
								) : (
									<LuChevronRight size={18} color="var(--mantine-color-dimmed)" />
								)}
							</Group>
						</UnstyledButton>

						<Collapse in={selected && !current}>
							<Stack
								gap="sm"
								p="sm"
								style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
							>
								<PasswordInput
									label={t('auth.chooser.passwordFor', { name: account.displayName })}
									value={password}
									onChange={(event) => setPassword(event.currentTarget.value)}
									onKeyDown={(event) => {
										if (event.key === 'Enter' && password) {
											onSelect({ userId: account.id, password });
										}
									}}
									autoComplete="current-password"
									autoFocus
								/>
								<Group justify="flex-end">
									<Button
										variant="subtle"
										onClick={() => setSelectedId(null)}
										disabled={pending}
									>
										{t('common.cancel')}
									</Button>
									<Button
										loading={pending}
										disabled={!password}
										onClick={() => onSelect({ userId: account.id, password })}
									>
										{t('auth.login.submit')}
									</Button>
								</Group>
							</Stack>
						</Collapse>
					</Box>
				);
			})}
		</Stack>
	);
}
