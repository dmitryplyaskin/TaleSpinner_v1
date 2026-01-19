import { Button, Group, Stack, Tabs } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { FormProvider, useForm, useFieldArray } from 'react-hook-form';
import { LuPlus, LuChevronUp, LuChevronDown, LuTrash2 } from 'react-icons/lu';

import { $selectedAgentCardForEdit, $isEditAgentCardModalOpen, setIsEditAgentCardModalOpen } from '@model/agent-cards';
import { Dialog } from '@ui/dialog';
import { FormInput, FormTextarea } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { AvatarUpload } from '../../../features/common/avatar-upload';

type CharacterCardV2 = {
	name: string;
	description: string;
	personality: string;
	scenario: string;
	first_mes: string;
	mes_example: string;
	creator_notes: string;
	system_prompt: string;
	post_history_instructions: string;
	creator: string;
	character_version: string;
	tags: Array<{ value: string; label: string }>;
	alternate_greetings: Array<{ value: string; label: string }>;
};

export const EditChatModal: React.FC = () => {
	const [isOpen, editingCard] = useUnit([$isEditAgentCardModalOpen, $selectedAgentCardForEdit]);

	const form = useForm<CharacterCardV2>({
		defaultValues: {
			name: '',
			description: '',
			personality: '',
			scenario: '',
			first_mes: '',
			mes_example: '',
			creator_notes: '',
			system_prompt: '',
			post_history_instructions: '',
			creator: '',
			character_version: '1.0',
			tags: [],
			alternate_greetings: [],
		},
	});

	const { fields, append, remove, swap } = useFieldArray({
		control: form.control,
		name: 'alternate_greetings',
	});

	useEffect(() => {
		if (editingCard) {
			form.reset({
				name: editingCard.name || '',
				description: editingCard.metadata?.description || '',
				personality: editingCard.metadata?.personality || '',
				scenario: editingCard.metadata?.scenario || '',
				first_mes: editingCard.metadata?.first_mes || '',
				mes_example: editingCard.metadata?.mes_example || '',
				creator_notes: editingCard.metadata?.creator_notes || '',
				system_prompt: editingCard.metadata?.system_prompt || '',
				post_history_instructions: editingCard.metadata?.post_history_instructions || '',
				creator: editingCard.metadata?.creator || '',
				character_version: editingCard.metadata?.character_version || '1.0',
				tags: editingCard.metadata?.tags || [],
				alternate_greetings: editingCard.metadata?.alternate_greetings || [],
			});
		}
	}, [editingCard, form]);

	const handleSubmit = form.handleSubmit(async (_data) => {
		setIsEditAgentCardModalOpen(false);
	});

	if (!isOpen || !editingCard) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) setIsEditAgentCardModalOpen(false);
			}}
			title="Редактировать карточку персонажа"
			size="cover"
			closeOnEscape={false}
			closeOnInteractOutside={false}
		>
			<FormProvider {...form}>
				<form id="dialog-form" onSubmit={handleSubmit}>
					<Tabs defaultValue="basic" variant="outline">
						<Tabs.List mb="md">
							<Tabs.Tab value="basic">Основная информация</Tabs.Tab>
							<Tabs.Tab value="additional">Дополнительные поля</Tabs.Tab>
							<Tabs.Tab value="greetings">Приветствия</Tabs.Tab>
						</Tabs.List>

						<Tabs.Panel value="basic">
							<Stack gap="md">
								<Group gap="md" align="flex-start" wrap="nowrap">
									<AvatarUpload
										size="2xl"
										name={editingCard.name}
										src={editingCard.avatarUrl}
										onAvatarChange={() => {}}
										saveFolder="agent-cards"
									/>
									<FormInput name="name" label="Имя персонажа" placeholder="Введите имя персонажа" />
								</Group>
								<FormTextarea
									name="description"
									label="Описание"
									placeholder="Опишите внешность, характер и другие особенности персонажа"
								/>
								<FormTextarea name="first_mes" label="Первое сообщение" placeholder="Первое сообщение от персонажа" />
							</Stack>
						</Tabs.Panel>

						<Tabs.Panel value="additional">
							<Stack gap="md">
								<FormTextarea
									name="personality"
									label="Личность"
									placeholder="Опишите черты характера, привычки и поведение персонажа"
								/>
								<FormTextarea
									name="scenario"
									label="Сценарий"
									placeholder="Опишите текущую ситуацию или контекст разговора"
								/>
								<FormTextarea
									name="mes_example"
									label="Пример диалога"
									placeholder="Пример того, как персонаж общается"
								/>
								<FormTextarea
									name="creator_notes"
									label="Заметки создателя"
									placeholder="Важные заметки для пользователей"
								/>
								<FormTextarea
									name="system_prompt"
									label="Системная инструкция"
									placeholder="Системные инструкции для модели (опционально)"
								/>
								<FormTextarea
									name="post_history_instructions"
									label="Пост-инструкции"
									placeholder="Инструкции, добавляемые после истории диалога (опционально)"
								/>
								<FormInput name="creator" label="Создатель" placeholder="Ваше имя или псевдоним" />
								<FormInput name="character_version" label="Версия" placeholder="Версия карточки персонажа" />
							</Stack>
						</Tabs.Panel>

						<Tabs.Panel value="greetings">
							<Stack gap="md">
								<Group justify="flex-end">
									<Button onClick={() => append({ value: '', label: '' })} size="sm" leftSection={<LuPlus />}>
										Добавить приветствие
									</Button>
								</Group>
								{fields.map((field, index) => (
									<Group key={field.id} align="flex-start" wrap="nowrap">
										<FormTextarea
											name={`alternate_greetings.${index}`}
											label={`Приветствие ${index + 1}`}
											placeholder="Введите альтернативное приветствие"
											textareaProps={{
												styles: { input: { minHeight: 300 } },
											}}
										/>
										<Stack mt="xl" gap="xs">
											<IconButtonWithTooltip
												tooltip="Переместить вверх"
												icon={<LuChevronUp />}
												aria-label="Переместить вверх"
												size="sm"
												disabled={index === 0}
												onClick={() => swap(index, index - 1)}
											/>
											<IconButtonWithTooltip
												tooltip="Переместить вниз"
												icon={<LuChevronDown />}
												aria-label="Переместить вниз"
												size="sm"
												disabled={index === fields.length - 1}
												onClick={() => swap(index, index + 1)}
											/>
											<IconButtonWithTooltip
												tooltip="Удалить"
												icon={<LuTrash2 />}
												aria-label="Удалить"
												size="sm"
												onClick={() => remove(index)}
											/>
										</Stack>
									</Group>
								))}
							</Stack>
						</Tabs.Panel>
					</Tabs>
				</form>
			</FormProvider>
		</Dialog>
	);
};

