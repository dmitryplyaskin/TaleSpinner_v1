import React, { useState, useRef } from 'react';
import { Box, Button, Flex, Input, Textarea, IconButton, VStack } from '@chakra-ui/react';
import { UserPersonType } from '@shared/types/user-person';
import { userPersonsModel } from '@model/user-persons';
import { LuPlus, LuX, LuUpload, LuTrash2 } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';
import { Field } from '@ui/chakra-core-ui/field';
import { Switch } from '@ui/chakra-core-ui/switch';
import { Avatar } from '@ui/chakra-core-ui/avatar';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/chakra-core-ui/toaster';
import { BASE_URL } from '../../../const';

interface UserPersonEditorProps {
	data: UserPersonType;
	onClose: () => void;
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ data, onClose }) => {
	const [personData, setPersonData] = useState<UserPersonType>(data);
	const [contentType, setContentType] = useState(data.type);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

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

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files || e.target.files.length === 0) return;

		const file = e.target.files[0];
		if (!file.type.startsWith('image/')) {
			toaster.error({
				title: 'Ошибка',
				description: 'Пожалуйста, загрузите изображение',
			});
			return;
		}

		const formData = new FormData();
		formData.append('files', file);

		setIsUploading(true);

		try {
			const response = await fetch(`${BASE_URL}/files/upload`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				throw new Error('Ошибка загрузки файла');
			}

			const result = await response.json();
			if (result.data && result.data.files && result.data.files.length > 0) {
				setPersonData({
					...personData,
					avatarUrl: result.data.files[0].filename,
				});

				toaster.success({
					title: 'Успешно',
					description: 'Аватар загружен',
				});
			}
		} catch (error) {
			toaster.error({
				title: 'Ошибка',
				description: 'Не удалось загрузить аватар',
			});
			console.error('Ошибка загрузки аватара:', error);
		} finally {
			setIsUploading(false);
		}
	};

	const handleRemoveAvatar = () => {
		setPersonData({
			...personData,
			avatarUrl: undefined,
		});
	};

	return (
		<Box p="4" borderWidth="1px" borderRadius="lg">
			<VStack gap={4} align="stretch">
				<Flex align="center" direction="column" gap={4}>
					<Box position="relative">
						<Avatar
							size="xl"
							name={personData.name}
							src={personData.avatarUrl ? `/media/card-images/${personData.avatarUrl}` : undefined}
						/>
						<Flex position="absolute" bottom="-2" right="-2" gap={1}>
							<IconButtonWithTooltip
								tooltip="Загрузить аватар"
								icon={<LuUpload />}
								size="xs"
								colorScheme="blue"
								onClick={() => fileInputRef.current?.click()}
							/>
							{personData.avatarUrl && (
								<IconButtonWithTooltip
									tooltip="Удалить аватар"
									icon={<LuTrash2 />}
									size="xs"
									colorScheme="red"
									onClick={handleRemoveAvatar}
								/>
							)}
						</Flex>
					</Box>
					<Box position="relative">
						<input
							type="file"
							ref={fileInputRef}
							style={{ display: 'none' }}
							accept="image/*"
							onChange={handleAvatarUpload}
						/>
					</Box>
					<Field label="Имя персоны" flex="1">
						<Input value={personData.name} onChange={(e) => setPersonData({ ...personData, name: e.target.value })} />
					</Field>
				</Flex>

				<Field label="Префикс">
					<Input
						value={personData.prefix || ''}
						onChange={(e) => setPersonData({ ...personData, prefix: e.target.value })}
					/>
				</Field>

				<Switch
					checked={contentType === 'extended'}
					onCheckedChange={(e) => handleContentTypeChange(e.checked ? 'extended' : 'default')}
				>
					Расширенная версия персоны
				</Switch>

				{contentType === 'default' ? (
					<Field label="Описание">
						<Textarea
							value={personData.contentTypeDefault || ''}
							autoresize
							minH={'200px'}
							onChange={(e) =>
								setPersonData({
									...personData,
									contentTypeDefault: e.target.value,
								})
							}
						/>
					</Field>
				) : (
					<Box>
						<Flex justify="space-between" align="center" mb={2}>
							<Field label="Дополнительные поля" />
							<IconButton aria-label="Add field" size="sm" onClick={handleAddField}>
								<LuPlus />
							</IconButton>
						</Flex>
						{personData.contentTypeExtended && (
							<VStack gap={2}>
								{personData.contentTypeExtended?.map((field) => (
									<Flex key={field.id} gap={2} w="full" direction={'column'}>
										<Input
											placeholder="Название поля"
											value={field.name || ''}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, name: e.target.value } : f,
													),
												})
											}
										/>
										<Input
											placeholder="Тег"
											value={field.tagName || ''}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, tagName: e.target.value } : f,
													),
												})
											}
										/>
										<Textarea
											autoresize
											placeholder="Значение"
											value={field.value}
											onChange={(e) =>
												setPersonData({
													...personData,
													contentTypeExtended: personData.contentTypeExtended?.map((f) =>
														f.id === field.id ? { ...f, value: e.target.value } : f,
													),
												})
											}
										/>
										<IconButton aria-label="Remove field" size="sm" onClick={() => handleRemoveField(field.id)}>
											<LuX />
										</IconButton>
									</Flex>
								))}
							</VStack>
						)}
					</Box>
				)}

				<Flex justify="flex-end" gap={2}>
					<Button variant="ghost" onClick={onClose}>
						Отмена
					</Button>
					<Button colorScheme="blue" onClick={handleSave}>
						Сохранить
					</Button>
				</Flex>
			</VStack>
		</Box>
	);
};
