import { Stack } from '@chakra-ui/react';
import { Dialog } from '@ui/dialog';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInput, FormTextarea, FormAutocomplete } from '@ui/form-components';
import { useUnit } from 'effector-react';
import { $editingCard, $isEditModalOpen, closeEditModal } from '@model/chats';
import { useEffect } from 'react';

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
};

export const EditChatModal: React.FC = () => {
	const [isOpen, editingCard] = useUnit([$isEditModalOpen, $editingCard]);

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
		},
	});

	useEffect(() => {
		if (editingCard) {
			form.reset({
				name: editingCard.title || '',
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
			});
		}
	}, [editingCard, form]);

	const handleSubmit = form.handleSubmit(async (data) => {
		// Здесь будет логика сохранения
		closeEditModal();
	});

	if (!isOpen || !editingCard) return null;

	return (
		<Dialog
			isOpen={isOpen}
			onClose={closeEditModal}
			title="Редактировать карточку персонажа"
			size="cover"
			closeOnEscape={false}
			closeOnInteractOutside={false}
		>
			{' '}
			<FormProvider {...form}>
				<form id="dialog-form" onSubmit={handleSubmit}>
					<Stack gap={4}>
						<FormInput name="name" label="Имя персонажа" placeholder="Введите имя персонажа" />
						<FormTextarea
							name="description"
							label="Описание"
							placeholder="Опишите внешность, характер и другие особенности персонажа"
						/>
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
						<FormTextarea name="first_mes" label="Первое сообщение" placeholder="Первое сообщение от персонажа" />
						<FormTextarea name="mes_example" label="Пример диалога" placeholder="Пример того, как персонаж общается" />
						<FormTextarea
							name="creator_notes"
							label="Заметки создателя"
							placeholder="Важные заметки для пользователей (рекомендации по настройкам, предупреждения и т.д.)"
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
						<FormAutocomplete
							name="tags"
							label="Теги"
							placeholder="Выберите теги"
							options={[
								{ value: '1', label: '1' },
								{ value: '2', label: '2' },
							]}
							// isMulti={true}
						/>
					</Stack>
				</form>
			</FormProvider>
		</Dialog>
	);
};
