import { Group, Stack } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
};

export const BasicsSection: React.FC<Props> = ({ index }) => {
	const { t } = useTranslation();
	return (
		<Stack gap="xs">
			<FormTextarea
				name={`operations.${index}.description`}
				label={t('operationProfiles.sectionsLabels.description')}
				infoTip={t('operationProfiles.tooltips.description')}
				textareaProps={{ minRows: 2, autosize: true }}
			/>

			<Group grow wrap="wrap">
				<FormCheckbox
					name={`operations.${index}.config.enabled`}
					label={t('operationProfiles.sectionsLabels.enabled')}
					infoTip={t('operationProfiles.tooltips.enabled')}
				/>
				<FormCheckbox
					name={`operations.${index}.config.required`}
					label={t('operationProfiles.sectionsLabels.required')}
					infoTip={t('operationProfiles.tooltips.required')}
				/>
			</Group>
		</Stack>
	);
};

