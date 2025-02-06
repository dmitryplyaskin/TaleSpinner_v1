import { Flex, Button } from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { InstructionType } from '@shared/types/instructions';
import {
	$selectedInstruction,
	createEmptyInstruction,
	createInstruction,
	updateInstruction,
} from '@model/instructions';
import { FormInput } from '@ui/form-components';
import { useUnit } from 'effector-react';

export const InstructionEditor: React.FC = () => {
	const selectedInstruction = useUnit($selectedInstruction);

	const methods = useForm<InstructionType>({
		defaultValues: selectedInstruction || createEmptyInstruction(),
	});

	const { handleSubmit } = methods;

	const onSubmit = (data: InstructionType) => {
		if (selectedInstruction) {
			updateInstruction({ ...data, updatedAt: new Date().toISOString() });
		} else {
			createInstruction(data);
		}
	};

	return (
		<FormProvider {...methods}>
			<Flex direction="column" h="100%" gap={4} mt={4}>
				<FormInput name="name" label="Название" placeholder="Введите название инструкции" />

				<FormTextarea
					name="instruction"
					label="Инструкция"
					placeholder="Введите текст инструкции"
					textareaProps={{
						minHeight: '300px',
					}}
				/>
				<Flex alignSelf="flex-end">
					<Button onClick={handleSubmit(onSubmit)}>Сохранить</Button>
				</Flex>
			</Flex>
		</FormProvider>
	);
};
