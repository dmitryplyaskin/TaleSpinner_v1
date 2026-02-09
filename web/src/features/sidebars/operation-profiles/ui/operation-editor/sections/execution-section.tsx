import { Group, Stack } from '@mantine/core';
import React from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormMultiSelect, FormNumberInput, FormSelect } from '@ui/form-components';

import { useOperationDepsOptions } from '../use-operation-deps-options';

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
	const depOptions = useOperationDepsOptions();
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

