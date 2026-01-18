import { Avatar, Group, Paper, Stack, Text } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React, { useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';

import { userPersonsModel } from '@model/user-persons';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { UserPersonEditor } from './user-person-editor';

interface UserPersonCardProps {
	data: UserPersonType;
}

export const UserPersonCard: React.FC<UserPersonCardProps> = ({ data }) => {
	const [isEditing, setIsEditing] = useState(false);

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleDelete = () => {
		userPersonsModel.deleteItemFx(data.id);
	};

	if (isEditing) {
		return <UserPersonEditor data={data} onClose={() => setIsEditing(false)} />;
	}

	return (
		<Paper withBorder radius="md" p="md">
			<Group justify="space-between" align="center" mb="xs" wrap="nowrap">
				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
					<Avatar size="md" name={data.name} src={data.avatarUrl ? `http://localhost:5000${data.avatarUrl}` : undefined} />
					<Stack gap={2} style={{ minWidth: 0 }}>
						<Text fw={700} truncate>
							{data.name}
						</Text>
						{data.prefix && (
							<Text size="sm" c="dimmed" truncate>
								{data.prefix}
							</Text>
						)}
					</Stack>
				</Group>
				<Group gap="xs" wrap="nowrap">
					<IconButtonWithTooltip
						tooltip="Редактировать"
						variant="ghost"
						size="sm"
						colorPalette="blue"
						aria-label="Edit"
						onClick={handleEdit}
						icon={<LuPencil />}
					/>
					<IconButtonWithTooltip
						tooltip="Удалить"
						variant="ghost"
						size="sm"
						colorPalette="red"
						aria-label="Delete"
						onClick={handleDelete}
						icon={<LuTrash2 />}
					/>
				</Group>
			</Group>
			<Text c="dimmed">{data.type === 'default' ? data.contentTypeDefault : 'Расширенная персона'}</Text>
		</Paper>
	);
};
