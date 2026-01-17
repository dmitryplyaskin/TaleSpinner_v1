import { Flex, Button } from '@chakra-ui/react';
import { type InstructionType } from '@shared/types/instructions';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { createEmptyInstruction , instructionsModel } from '@model/instructions';
import { FormInput } from '@ui/form-components';
import { FormTextarea } from '@ui/form-components/form-textarea';

export const InstructionEditor: React.FC = () => {
	const selectedInstruction = useUnit(instructionsModel.$selectedItem);

	const methods = useForm<InstructionType>({
		defaultValues: selectedInstruction || createEmptyInstruction(),
	});

	const { handleSubmit } = methods;

	const onSubmit = (data: InstructionType) => {
		if (selectedInstruction) {
			instructionsModel.updateItemFx({ ...data, updatedAt: new Date().toISOString() });
		} else {
			instructionsModel.createItemFx(data);
		}
	};

	useEffect(() => {
		methods.reset(selectedInstruction || createEmptyInstruction());
	}, [selectedInstruction]);

	return (
		<FormProvider {...methods}>
			<Flex direction="column" gap={4} mt={4}>
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
