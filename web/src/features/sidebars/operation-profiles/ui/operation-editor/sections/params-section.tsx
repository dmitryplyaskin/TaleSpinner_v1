import { Stack, Text } from '@mantine/core';
import React from 'react';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
	kind: 'template' | 'other';
};

export const ParamsSection: React.FC<Props> = ({ index, kind }) => {
	if (kind === 'template') {
		return (
			<Stack gap="xs">
				<Text fw={600}>Template</Text>
				<FormCheckbox
					name={`operations.${index}.config.params.strictVariables`}
					label="Strict variables"
					infoTip="When enabled, the template may only use allowed/known variables (strict validation)."
				/>
				<FormTextarea
					name={`operations.${index}.config.params.template`}
					label="Template"
					infoTip="Operation template text (kind=template)."
					textareaProps={{ minRows: 4, autosize: true }}
				/>
			</Stack>
		);
	}

	return (
		<Stack gap="xs">
			<Text fw={600}>Params</Text>
			<FormTextarea
				name={`operations.${index}.config.params.paramsJson`}
				label="Advanced JSON params"
				infoTip="Temporary editor for non-template kinds. Keep it valid JSON object syntax."
				textareaProps={{ minRows: 6, autosize: true }}
			/>
		</Stack>
	);
};

