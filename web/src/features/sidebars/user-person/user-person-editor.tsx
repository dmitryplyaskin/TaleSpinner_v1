import { Button, Group, Paper, Stack, TextInput, Textarea } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React, { useState } from 'react';

import { userPersonsModel } from '@model/user-persons';

import { AvatarUpload } from '../../../features/common/avatar-upload';

interface UserPersonEditorProps {
	data: UserPersonType;
	onClose: () => void;
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ data, onClose }) => {
	const [personData, setPersonData] = useState<UserPersonType>(data);

	const handleSave = () => {
		userPersonsModel.updateItemFx({
			...personData,
			type: 'default',
		});
		onClose();
	};

	const handleAvatarChange = (avatarUrl: string) => {
		const updatedData = {
			...personData,
			avatarUrl,
			type: 'default' as const,
		};

		setPersonData(updatedData);
		userPersonsModel.updateItemFx(updatedData);
	};

	return (
		<Paper withBorder radius="md" p="md">
			<Stack gap="md">
				<Group align="center" wrap="nowrap">
					<AvatarUpload
						size="2xl"
						name={personData.name}
						src={personData.avatarUrl}
						onAvatarChange={handleAvatarChange}
						saveFolder="user-persons"
					/>

					<TextInput
						label="Имя персоны"
						value={personData.name}
						onChange={(e) => setPersonData({ ...personData, name: e.currentTarget.value })}
						style={{ flex: 1 }}
					/>
				</Group>

				<TextInput
					label="Префикс"
					value={personData.prefix || ''}
					onChange={(e) => setPersonData({ ...personData, prefix: e.currentTarget.value })}
				/>

				<Textarea
					label="Описание"
					value={personData.contentTypeDefault || ''}
					autosize
					minRows={6}
					onChange={(e) =>
						setPersonData({
							...personData,
							type: 'default',
							contentTypeDefault: e.currentTarget.value,
						})
					}
				/>

				<Group justify="flex-end" gap="sm">
					<Button variant="subtle" onClick={onClose}>
						Отмена
					</Button>
					<Button onClick={handleSave}>
						Сохранить
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
};
