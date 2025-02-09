import React, { useState } from 'react';
import { Box, Button, Flex, Input, Textarea, IconButton, VStack } from '@chakra-ui/react';
import { UserPerson } from '@shared/types/user-person';
import { userPersonsModel } from '@model/user-persons';
import { LuPlus, LuX } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';
import { Field } from '@ui/chakra-core-ui/field';
import { Switch } from '@ui/chakra-core-ui/switch';

interface UserPersonEditorProps {
	data: UserPerson;
	onClose: () => void;
}

export const UserPersonEditor: React.FC<UserPersonEditorProps> = ({ data, onClose }) => {
	const [personData, setPersonData] = useState<UserPerson>(data);
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

	return (
		<Box p="4" borderWidth="1px" borderRadius="lg">
			<VStack gap={4} align="stretch">
				<Field label="Имя персоны">
					<Input value={personData.name} onChange={(e) => setPersonData({ ...personData, name: e.target.value })} />
				</Field>

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
