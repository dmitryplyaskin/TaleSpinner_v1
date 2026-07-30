import { Avatar, Group, Paper, Stack, Text } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { BookBookmarkIcon, PencilSimpleIcon, TrashIcon } from '@ui/icons';


import { BACKEND_ORIGIN } from '../../../api/chat-core';

interface UserPersonCardProps {
	data: UserPersonType;
	isActive: boolean;
	worldInfoBookName: string | null;
	onSelect: (person: UserPersonType) => void;
	onEdit: (person: UserPersonType) => void;
	onDelete: (person: UserPersonType) => void;
}

export const UserPersonCard: React.FC<UserPersonCardProps> = ({
	data,
	isActive,
	worldInfoBookName,
	onSelect,
	onEdit,
	onDelete,
}) => {
	const { t } = useTranslation();
	const avatarUrl = data.avatarUrl ? `${BACKEND_ORIGIN}${data.avatarUrl}` : undefined;

	return (
		<Paper
			withBorder
			radius="md"
			p="md"
			className="ts-sidebar-card"
			onClick={() => onSelect(data)}
			style={{
				cursor: 'pointer',
				borderColor: isActive ? 'var(--mantine-color-cyan-6)' : undefined,
				boxShadow: isActive ? '0 0 0 2px var(--ts-accent-soft)' : undefined,
			}}
		>
			<Group justify="space-between" align="center" mb="xs" wrap="nowrap">
				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
					<Avatar size="md" name={data.name} src={avatarUrl} />
					<Stack gap={2} style={{ minWidth: 0 }}>
						<Group gap={6} wrap="nowrap">
							<Text fw={700} truncate>
								{data.name}
							</Text>
							<IconButtonWithTooltip
								tooltip={
									worldInfoBookName
										? t('userPersons.worldInfo.statusBoundTooltip', { name: worldInfoBookName })
										: t('userPersons.worldInfo.statusUnboundTooltip')
								}
								variant={worldInfoBookName ? 'subtle' : 'outline'}
								colorPalette={worldInfoBookName ? 'cyan' : 'gray'}
								size="xs"
								aria-label={t('userPersons.worldInfo.statusAria')}
								icon={<BookBookmarkIcon />}
							/>
							{isActive && (
								<Text c="cyan" size="xs" fw={600}>
									{t('userPersons.badges.active')}
								</Text>
							)}
						</Group>
						{data.prefix && (
							<Text size="sm" c="dimmed" truncate>
								{data.prefix}
							</Text>
						)}
					</Stack>
				</Group>
				<Group gap="xs" wrap="nowrap">
					<IconButtonWithTooltip
						tooltip={t('common.edit')}
						variant="ghost"
						size="sm"
						colorPalette="blue"
						aria-label={t('common.edit')}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onEdit(data);
						}}
						icon={<PencilSimpleIcon />}
					/>
					<IconButtonWithTooltip
						tooltip={t('common.delete')}
						variant="ghost"
						size="sm"
						colorPalette="red"
						aria-label={t('common.delete')}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onDelete(data);
						}}
						icon={<TrashIcon />}
					/>
				</Group>
			</Group>
			<Text c="dimmed">{data.contentTypeDefault || ''}</Text>
		</Paper>
	);
};
