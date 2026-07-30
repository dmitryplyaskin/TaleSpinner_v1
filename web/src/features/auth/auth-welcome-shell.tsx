import {
	Alert,
	Badge,
	Box,
	Button,
	Divider,
	Group,
	Paper,
	Stack,
	Text,
	ThemeIcon,
	Title,
	Transition,
} from '@mantine/core';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { WarningCircleIcon, SparkleIcon } from '@ui/icons';

import type { AccessMode } from '../../api/auth';

type AuthWelcomeShellProps = {
	mode: AccessMode;
	title: string;
	description: string;
	error: string | null;
	onRetry: () => void;
	children: ReactNode;
};

export function AuthWelcomeShell({
	mode,
	title,
	description,
	error,
	onRetry,
	children,
}: AuthWelcomeShellProps) {
	const { t } = useTranslation();

	return (
		<Box
			mih="100vh"
			style={{ background: 'var(--mantine-color-body)', display: 'grid', placeItems: 'center' }}
			p={{ base: 'md', sm: 'xl' }}
		>
			<Transition mounted transition="fade-up" duration={220} timingFunction="ease-out">
				{(transitionStyle) => (
					<Paper
						withBorder
						radius="xl"
						p={{ base: 'lg', sm: 32 }}
						w="100%"
						maw={560}
						style={{
							...transitionStyle,
							boxShadow: '0 24px 80px color-mix(in srgb, var(--mantine-color-black) 12%, transparent)',
						}}
					>
						<Stack gap="lg">
							<Group justify="space-between" align="flex-start">
								<Group gap="sm">
									<ThemeIcon size={42} radius="md" variant="light" color="cyan">
										<SparkleIcon size={22} />
									</ThemeIcon>
									<Box>
										<Title order={1} size="h2">
											TaleSpinner
										</Title>
										<Text size="sm" c="dimmed">
											{t('auth.welcome.productDescription')}
										</Text>
									</Box>
								</Group>
								<Badge variant="light" color={mode === 'local' ? 'teal' : 'blue'}>
									{t(`auth.modes.${mode}`)}
								</Badge>
							</Group>
							<Divider />
							<Stack gap="xs">
								<Title order={2} size="h3">
									{title}
								</Title>
								<Text c="dimmed" size="sm">
									{description}
								</Text>
							</Stack>
							{error && (
								<Alert color="red" variant="light" icon={<WarningCircleIcon size={18} />}>
									{error}
								</Alert>
							)}
							{children}
							{error && (
								<Button variant="subtle" size="compact-sm" onClick={onRetry}>
									{t('auth.retry')}
								</Button>
							)}
						</Stack>
					</Paper>
				)}
			</Transition>
		</Box>
	);
}
