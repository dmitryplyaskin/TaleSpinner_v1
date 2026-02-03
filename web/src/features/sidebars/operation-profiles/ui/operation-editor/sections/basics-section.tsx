import { Group, Stack, Text } from '@mantine/core';
import React from 'react';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

const RequiredInfoTip =
	'If required=true, operation must finish with status="done". Otherwise the Run will not pass the before_main_llm barrier, or will be marked as failed for after_main_llm.';

type Props = {
	index: number;
};

export const BasicsSection: React.FC<Props> = ({ index }) => {
	return (
		<Stack gap="xs">
			<Text fw={600}>Basics</Text>

			<FormTextarea
				name={`operations.${index}.description`}
				label="Description"
				infoTip="Short operation description. Shown in nodes and can be used for profile documentation."
				textareaProps={{ minRows: 2, autosize: true }}
			/>

			<Group grow wrap="wrap">
				<FormCheckbox
					name={`operations.${index}.config.enabled`}
					label="Enabled"
					infoTip='If disabled, operation is treated as skipped and will not commit any effects.'
				/>
				<FormCheckbox name={`operations.${index}.config.required`} label="Required" infoTip={RequiredInfoTip} />
			</Group>
		</Stack>
	);
};

