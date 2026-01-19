import { Button, Group, Stack, Switch, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import {
	$selectedPromptTemplate,
	updatePromptTemplateRequested,
} from '@model/prompt-templates';
import { FormInput } from '@ui/form-components';

type FormValues = {
	name: string;
	enabled: boolean;
	templateText: string;
};

export const PromptTemplateEditor = () => {
	const tpl = useUnit($selectedPromptTemplate);

	const methods = useForm<FormValues>({
		defaultValues: {
			name: tpl?.name ?? '',
			enabled: tpl?.enabled ?? true,
			templateText: tpl?.templateText ?? '',
		},
	});

	useEffect(() => {
		methods.reset({
			name: tpl?.name ?? '',
			enabled: tpl?.enabled ?? true,
			templateText: tpl?.templateText ?? '',
		});
	}, [tpl?.id]);

	if (!tpl) return null;

	const onSubmit = (data: FormValues) => {
		updatePromptTemplateRequested({
			id: tpl.id,
			name: data.name,
			enabled: data.enabled,
			templateText: data.templateText,
		});
	};

	return (
		<FormProvider {...methods}>
			<Stack gap="md" mt="md">
				<FormInput name="name" label="Название" placeholder="Введите название" />

				<Switch
					label="Enabled"
					checked={methods.watch('enabled')}
					onChange={(e) => methods.setValue('enabled', e.currentTarget.checked, { shouldDirty: true })}
				/>

				<Textarea
					label="Template (LiquidJS)"
					description="Синтаксис проверяется на бэкенде при сохранении."
					value={methods.watch('templateText')}
					onChange={(e) => methods.setValue('templateText', e.currentTarget.value, { shouldDirty: true })}
					minRows={14}
					autosize
					styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
				/>

				<Group justify="flex-end">
					<Button onClick={methods.handleSubmit(onSubmit)}>Сохранить</Button>
				</Group>
			</Stack>
		</FormProvider>
	);
};

