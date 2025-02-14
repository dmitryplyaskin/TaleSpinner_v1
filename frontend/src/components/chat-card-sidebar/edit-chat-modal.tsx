import { Stack, Button } from '@chakra-ui/react';
import { Dialog } from '@ui/dialog';
import { FormProvider, useForm, useFieldArray } from 'react-hook-form';
import { FormInput, FormTextarea } from '@ui/form-components';
import { useUnit } from 'effector-react';
import { $selectedAgentCardForEdit, $isEditAgentCardModalOpen, setIsEditAgentCardModalOpen } from '@model/chat-list';
import { useEffect } from 'react';
import { Tabs } from '@chakra-ui/react';
import { LuPlus, LuChevronUp, LuChevronDown, LuTrash2 } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

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

	console.log('WTF', { editingCard });
	form.watch(console.log);

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

	const handleSubmit = form.handleSubmit(async (data) => {
		// Здесь будет логика сохранения
		setIsEditAgentCardModalOpen(false);
	});

	if (!isOpen || !editingCard) return null;

	return (
		<Dialog
			isOpen={isOpen}
			onClose={() => setIsEditAgentCardModalOpen(false)}
			title="Редактировать карточку персонажа"
			size="cover"
			closeOnEscape={false}
			closeOnInteractOutside={false}
		>
			<FormProvider {...form}>
				<form id="dialog-form" onSubmit={handleSubmit}>
					<Tabs.Root defaultValue="basic" variant="plain" size="sm">
						<Tabs.List bg="bg.muted" rounded="l3" p="1">
							<Tabs.Trigger value="basic">Основная информация</Tabs.Trigger>
							<Tabs.Trigger value="additional">Дополнительные поля</Tabs.Trigger>
							<Tabs.Trigger value="greetings">Приветствия</Tabs.Trigger>
							<Tabs.Indicator rounded="l2" />
						</Tabs.List>

						<Tabs.Content value="basic" pt="4">
							<Stack gap={4}>
								<FormInput name="name" label="Имя персонажа" placeholder="Введите имя персонажа" />
								<FormTextarea
									name="description"
									label="Описание"
									placeholder="Опишите внешность, характер и другие особенности персонажа"
								/>
								<FormTextarea name="first_mes" label="Первое сообщение" placeholder="Первое сообщение от персонажа" />
							</Stack>
						</Tabs.Content>

						<Tabs.Content value="additional" pt="4">
							<Stack gap={4}>
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
						</Tabs.Content>

						<Tabs.Content value="greetings" pt="4">
							<Stack gap={4}>
								<Stack direction="row" justify="flex-end">
									<Button onClick={() => append({ value: '', label: '' })} size="sm">
										<LuPlus style={{ marginRight: '8px' }} />
										Добавить приветствие
									</Button>
								</Stack>
								{fields.map((field, index) => (
									<Stack key={field.id} direction="row" align="flex-start">
										<FormTextarea
											name={`alternate_greetings.${index}`}
											label={`Приветствие ${index + 1}`}
											placeholder="Введите альтернативное приветствие"
											textareaProps={{
												minH: '300px',
											}}
										/>
										<Stack mt={10}>
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
									</Stack>
								))}
							</Stack>
						</Tabs.Content>
					</Tabs.Root>
				</form>
			</FormProvider>
		</Dialog>
	);
};
