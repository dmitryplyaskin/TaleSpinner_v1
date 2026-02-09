import { Button, Group, Stack } from '@mantine/core';
import { type InstructionType } from '@shared/types/instructions';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { createEmptyInstruction , instructionsModel } from '@model/instructions';
import { FormInput } from '@ui/form-components';
import { FormTextarea } from '@ui/form-components/form-textarea';

export const InstructionEditor: React.FC = () => {
	const { t } = useTranslation();
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
			<Stack gap="md" mt="md">
				<FormInput name="name" label={t('instructions.fields.name')} placeholder={t('instructions.placeholders.name')} />

				<FormTextarea
					name="instruction"
					label={t('instructions.fields.instruction')}
					placeholder={t('instructions.placeholders.instruction')}
					textareaProps={{
						styles: { input: { minHeight: 300 } },
					}}
				/>
				<Group justify="flex-end">
					<Button onClick={handleSubmit(onSubmit)}>{t('common.save')}</Button>
				</Group>
			</Stack>
		</FormProvider>
	);
};
