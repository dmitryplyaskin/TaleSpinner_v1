import { Group, Stack } from '@mantine/core';
import React, { useMemo } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormMultiSelect, FormNumberInput, FormSelect } from '@ui/form-components';

import type { OperationProfileFormValues } from '../../../form/operation-profile-form-mapping';

const hookOptions = [
	{ value: 'before_main_llm', label: 'before_main_llm' },
	{ value: 'after_main_llm', label: 'after_main_llm' },
];

const triggerOptions = [
	{ value: 'generate', label: 'generate' },
	{ value: 'regenerate', label: 'regenerate' },
];

type Props = {
	index: number;
};

export const ExecutionSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	const { control } = useFormContext<OperationProfileFormValues>();
	const { fields } = useFieldArray({
		control,
		name: 'operations',
		keyName: '_key',
	});

	const namePaths = useMemo(() => fields.map((_, idx) => `operations.${idx}.name`), [fields]);
	const watchedNames = useWatch({ control, name: namePaths as any }) as unknown[] | undefined;

	const depOptions = useMemo(() => {
		return fields
			.map((field, idx) => {
				const opId = typeof field.opId === 'string' ? field.opId : '';
				if (!opId) return null;
				const nameValue = watchedNames?.[idx];
				const name = typeof nameValue === 'string' ? nameValue : '';
				return { value: opId, label: name.trim() ? `${name} — ${opId}` : opId };
			})
			.filter((option): option is { value: string; label: string } => option !== null);
	}, [fields, watchedNames]);

	const selfOpId = useWatch({ name: `operations.${index}.opId` }) as unknown;
	const selfId = typeof selfOpId === 'string' ? selfOpId : '';

	return (
		<Stack gap="xs">
			<Group grow wrap="wrap">
				<FormSelect
					name={`operations.${index}.config.hooks.0`}
					label={t('operationProfiles.sectionsLabels.hook')}
					infoTip={t('operationProfiles.tooltips.hook')}
					selectProps={{
						options: hookOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
				<FormMultiSelect
					name={`operations.${index}.config.triggers`}
					label={t('operationProfiles.sectionsLabels.triggers')}
					infoTip={t('operationProfiles.tooltips.triggers')}
					multiSelectProps={{
						options: triggerOptions,
						comboboxProps: { withinPortal: false },
					}}
				/>
			</Group>

			<Group grow wrap="wrap">
				<FormNumberInput
					name={`operations.${index}.config.order`}
					label={t('operationProfiles.sectionsLabels.order')}
					infoTip={t('operationProfiles.tooltips.order')}
					numberInputProps={{ min: 0 }}
				/>
				<FormMultiSelect
					name={`operations.${index}.config.dependsOn`}
					label={t('operationProfiles.sectionsLabels.dependsOn')}
					infoTip={t('operationProfiles.tooltips.dependsOn')}
					multiSelectProps={{
						options: depOptions.filter((o) => o.value !== selfId),
						comboboxProps: { withinPortal: false },
						placeholder: t('operationProfiles.placeholders.none'),
						searchable: true,
					}}
				/>
			</Group>
		</Stack>
	);
};

