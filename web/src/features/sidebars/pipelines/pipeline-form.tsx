import { Alert, Button, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type PipelineDbType, createEmptyPipeline, pipelinesModel } from '@model/pipelines';
import { FormInput } from '@ui/form-components';

export const PipelineForm = () => {
	const selectedPipeline = useUnit(pipelinesModel.$selectedItem);
	const [jsonError, setJsonError] = useState<string | null>(null);

	type PipelineFormValues = Omit<PipelineDbType, 'definition'> & { definitionJson: string };

	const initialValues = useMemo<PipelineFormValues>(() => {
		const p = selectedPipeline ?? createEmptyPipeline();
		return {
			...p,
			definitionJson: JSON.stringify(p.definition ?? {}, null, 2),
		};
	}, [selectedPipeline]);

	const methods = useForm<PipelineFormValues>({ defaultValues: initialValues });

	useEffect(() => {
		setJsonError(null);
		methods.reset(initialValues);
	}, [selectedPipeline]);

	const onSubmit = (data: PipelineFormValues) => {
		let definition: unknown = {};
		try {
			definition = data.definitionJson?.trim() ? (JSON.parse(data.definitionJson) as unknown) : {};
			setJsonError(null);
		} catch (e) {
			setJsonError(e instanceof Error ? e.message : String(e));
			return;
		}

		const payload: PipelineDbType = {
			id: data.id,
			name: data.name,
			enabled: Boolean(data.enabled),
			definition,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};

		if (selectedPipeline) {
			pipelinesModel.updateItemFx({ ...payload, updatedAt: new Date().toISOString() });
		} else {
			pipelinesModel.createItemFx(payload);
		}
	};

	return (
		<FormProvider {...methods}>
			<Stack gap="md">
				<Text size="lg" fw={700}>
					Pipeline
				</Text>

				<FormInput name="name" label="Название" placeholder="Введите название пайплайна" />

				<Switch
					label="Enabled"
					checked={methods.watch('enabled')}
					onChange={(e) => methods.setValue('enabled', e.currentTarget.checked, { shouldDirty: true })}
				/>

				<Textarea
					label="definitionJson"
					description="JSON-определение пайплайна (DB-first)."
					value={methods.watch('definitionJson')}
					onChange={(e) => methods.setValue('definitionJson', e.currentTarget.value, { shouldDirty: true })}
					minRows={12}
					autosize
					styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
				/>

				{jsonError && (
					<Alert color="red" title="JSON ошибка">
						{jsonError}
					</Alert>
				)}

				<Button onClick={methods.handleSubmit(onSubmit)}>Сохранить</Button>
			</Stack>
		</FormProvider>
	);
};
