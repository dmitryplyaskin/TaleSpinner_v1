import { Flex, Button } from '@chakra-ui/react';
import { type TemplateType } from '@shared/types/templates';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { createEmptyTemplate , templatesModel } from '@model/template';
import { FormInput } from '@ui/form-components';
import { FormTextarea } from '@ui/form-components/form-textarea';

export const TemplateEditor: React.FC = () => {
	const selectedTemplate = useUnit(templatesModel.$selectedItem);

	const methods = useForm<TemplateType>({
		defaultValues: selectedTemplate || createEmptyTemplate(),
	});

	const { handleSubmit } = methods;

	const onSubmit = (data: TemplateType) => {
		if (selectedTemplate) {
			templatesModel.updateItemFx({ ...data, updatedAt: new Date().toISOString() });
		} else {
			templatesModel.createItemFx(data);
		}
	};

	useEffect(() => {
		methods.reset(selectedTemplate || createEmptyTemplate());
	}, [selectedTemplate]);

	return (
		<FormProvider {...methods}>
			<Flex direction="column" gap={4} mt={4}>
				<FormInput name="name" label="Название" placeholder="Введите название шаблона" />

				<FormTextarea
					name="template"
					label="Шаблон"
					placeholder="Введите текст шаблона"
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
