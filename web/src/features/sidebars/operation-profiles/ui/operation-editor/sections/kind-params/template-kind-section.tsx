import { Stack, Text } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
};

export const TemplateKindSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<Stack gap="xs">
			<Text size="sm" c="dimmed">
				{t('operationProfiles.kindSection.template.description')}
			</Text>
			<FormCheckbox
				name={`operations.${index}.config.params.strictVariables`}
				label={t('operationProfiles.kindSection.template.strictVariables')}
				infoTip={t('operationProfiles.kindSection.template.strictVariablesInfo')}
			/>
			<FormTextarea
				name={`operations.${index}.config.params.template`}
				label={t('operationProfiles.kindSection.template.templateText')}
				infoTip={t('operationProfiles.kindSection.template.templateTextInfo')}
				textareaProps={{ minRows: 6, maxRows: 16, autosize: false, placeholder: '{{user_input}}' }}
			/>
		</Stack>
	);
};
