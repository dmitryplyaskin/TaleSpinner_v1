import { Button, Group, Paper, Stack, TextInput, Textarea } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { userPersonsModel } from '@model/user-persons';

import { AvatarUpload } from '../../../features/common/avatar-upload';

interface UserPersonEditorProps {
	data: UserPersonType;
	onClose: () => void;
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ data, onClose }) => {
	const { t } = useTranslation();
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
						label={t('userPersons.fields.name')}
						value={personData.name}
						onChange={(e) => setPersonData({ ...personData, name: e.currentTarget.value })}
						style={{ flex: 1 }}
					/>
				</Group>

				<TextInput
					label={t('userPersons.fields.prefix')}
					value={personData.prefix || ''}
					onChange={(e) => setPersonData({ ...personData, prefix: e.currentTarget.value })}
				/>

				<Textarea
					label={t('userPersons.fields.description')}
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
						{t('common.cancel')}
					</Button>
					<Button onClick={handleSave}>
						{t('common.save')}
					</Button>
				</Group>
			</Stack>
		</Paper>
	);
};
