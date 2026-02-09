import { Stack, Text } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
	kindLabel: string;
	description: string;
	placeholder: string;
};

export const JsonKindParamsSection: React.FC<Props> = ({ index, kindLabel, description, placeholder }) => {
	const { t } = useTranslation();
	return (
		<Stack gap="xs">
			<Text size="sm" c="dimmed">
				{description}
			</Text>
			<FormTextarea
				name={`operations.${index}.config.params.paramsJson`}
				label={t('operationProfiles.kindSection.jsonParamsLabel', { kindLabel })}
				infoTip={t('operationProfiles.kindSection.jsonParamsInfo')}
				textareaProps={{ minRows: 8, autosize: true, placeholder }}
			/>
		</Stack>
	);
};
