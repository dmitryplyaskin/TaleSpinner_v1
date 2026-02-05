import { Stack, Text } from '@mantine/core';
import React from 'react';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
};

export const TemplateKindSection: React.FC<Props> = ({ index }) => {
	return (
		<Stack gap="xs">
			<Text size="sm" c="dimmed">
				Template operations render text using available variables and pass the result to output effects.
			</Text>
			<FormCheckbox
				name={`operations.${index}.config.params.strictVariables`}
				label="Strict variables"
				infoTip="When enabled, the template may use only declared variables."
			/>
			<FormTextarea
				name={`operations.${index}.config.params.template`}
				label="Template text"
				infoTip="Body of the operation template."
				textareaProps={{ minRows: 5, autosize: true, placeholder: '{{user_input}}' }}
			/>
		</Stack>
	);
};
