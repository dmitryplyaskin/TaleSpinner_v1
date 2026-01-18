import { ActionIcon, Button, Group, Paper, Stack, Switch, TextInput, Textarea, Text } from '@mantine/core';
import { type UserPersonType } from '@shared/types/user-person';
import React, { useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import { userPersonsModel } from '@model/user-persons';

import { AvatarUpload } from '../../../features/common/avatar-upload';

interface UserPersonEditorProps {
	data: UserPersonType;
	onClose: () => void;
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ data, onClose }) => {
	const [personData, setPersonData] = useState<UserPersonType>(data);
	const [contentType, setContentType] = useState(data.type);

	const handleSave = () => {
		userPersonsModel.updateItemFx(personData);
		onClose();
	};

	const handleAddField = () => {
		if (personData.type === 'extended') {
			const newField = {
				id: uuidv4(),
				name: '',
				value: '',
				isEnabled: true,
			};
			setPersonData({
				...personData,
				contentTypeExtended: personData.contentTypeExtended
					? [...personData.contentTypeExtended, newField]
					: [newField],
			});
		}
	};

	const handleRemoveField = (id: string) => {
		if (personData.type === 'extended' && personData.contentTypeExtended) {
			setPersonData({
				...personData,
				contentTypeExtended: personData.contentTypeExtended.filter((field) => field.id !== id),
			});
		}
	};

	const handleContentTypeChange = (type: 'default' | 'extended') => {
		setContentType(type);
		setPersonData({
			...personData,
			type,
		});
	};

	const handleAvatarChange = (avatarUrl: string) => {
		const updatedData = {
			...personData,
			avatarUrl,
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

				<Switch
					checked={contentType === 'extended'}
					onChange={(e) => handleContentTypeChange(e.currentTarget.checked ? 'extended' : 'default')}
					label="Расширенная версия персоны"
				/>

				{contentType === 'default' ? (
					<Textarea
						label="Описание"
						value={personData.contentTypeDefault || ''}
						autosize
						minRows={6}
						onChange={(e) =>
							setPersonData({
								...personData,
								contentTypeDefault: e.currentTarget.value,
							})
						}
					/>
				) : (
					<Stack gap="sm">
						<Group justify="space-between" align="center">
							<Text fw={500}>Дополнительные поля</Text>
							<ActionIcon aria-label="Add field" size="sm" variant="outline" onClick={handleAddField}>
								<LuPlus />
							</ActionIcon>
						</Group>
						{personData.contentTypeExtended && (
							<Stack gap="sm">
								{personData.contentTypeExtended?.map((field) => (
									<Stack key={field.id} gap="xs">
										<TextInput
											placeholder="Название поля"
											value={field.name || ''}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, name: e.currentTarget.value } : f,
													),
												})
											}
										/>
										<TextInput
											placeholder="Тег"
											value={field.tagName || ''}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, tagName: e.currentTarget.value } : f,
													),
												})
											}
										/>
										<Textarea
											autosize
											placeholder="Значение"
											value={field.value}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, value: e.currentTarget.value } : f,
													),
												})
											}
										/>
										<ActionIcon
											aria-label="Remove field"
											size="sm"
											variant="outline"
											color="red"
											onClick={() => handleRemoveField(field.id)}
										>
											<LuX />
										</ActionIcon>
									</Stack>
								))}
							</Stack>
						)}
					</Stack>
				)}

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
