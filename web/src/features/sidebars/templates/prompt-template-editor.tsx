import { Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { $currentBranchId, $currentChat, $currentEntityProfile } from '@model/chat-core';
import {
	$selectedPromptTemplate,
	updatePromptTemplateRequested,
} from '@model/prompt-templates';
import { FormInput } from '@ui/form-components';

import { prerenderPromptTemplate } from '../../../api/prompt-templates';

type FormValues = {
	name: string;
	templateText: string;
};

export const PromptTemplateEditor = () => {
	const { t } = useTranslation();
	const tpl = useUnit($selectedPromptTemplate);
	const [chat, branchId, profile] = useUnit([$currentChat, $currentBranchId, $currentEntityProfile]);

	const [preview, setPreview] = useState<string>('');
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);

	const methods = useForm<FormValues>({
		defaultValues: {
			name: tpl?.name ?? '',
			templateText: tpl?.templateText ?? '',
		},
	});

	useEffect(() => {
		methods.reset({
			name: tpl?.name ?? '',
			templateText: tpl?.templateText ?? '',
		});
		setPreview('');
		setPreviewError(null);
	}, [tpl?.id]);

	if (!tpl) return null;

	const onSubmit = (data: FormValues) => {
		updatePromptTemplateRequested({
			id: tpl.id,
			name: data.name,
			templateText: data.templateText,
		});
	};

	const onPrerender = async () => {
		setPreviewLoading(true);
		setPreviewError(null);
		try {
			const data = await prerenderPromptTemplate({
				templateText: methods.getValues('templateText'),
				chatId: chat?.id ?? undefined,
				branchId: branchId ?? undefined,
				entityProfileId: profile?.id ?? undefined,
				historyLimit: 50,
			});
			setPreview(data.rendered);
		} catch (e) {
			setPreview('');
			setPreviewError(e instanceof Error ? e.message : String(e));
		} finally {
			setPreviewLoading(false);
		}
	};

	return (
		<FormProvider {...methods}>
			<Stack gap="md" mt="md">
				<FormInput name="name" label={t('templates.fields.name')} placeholder={t('templates.placeholders.name')} />

				<Textarea
					label={t('templates.fields.templateText')}
					description={t('templates.fields.templateTextDescription')}
					value={methods.watch('templateText')}
					onChange={(e) => methods.setValue('templateText', e.currentTarget.value, { shouldDirty: true })}
					minRows={14}
					autosize
					styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
				/>

				{previewError && (
					<Text c="red" size="sm">
						{previewError}
					</Text>
				)}

				{preview.length > 0 && (
					<Textarea
						label={t('templates.fields.prerender')}
						description={t('templates.fields.prerenderDescription')}
						value={preview}
						readOnly
						minRows={10}
						autosize
						styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
					/>
				)}

				<Group justify="flex-end">
					<Button variant="light" loading={previewLoading} onClick={onPrerender}>
						{t('templates.actions.prerender')}
					</Button>
					<Button onClick={methods.handleSubmit(onSubmit)}>{t('common.save')}</Button>
				</Group>
			</Stack>
		</FormProvider>
	);
};

