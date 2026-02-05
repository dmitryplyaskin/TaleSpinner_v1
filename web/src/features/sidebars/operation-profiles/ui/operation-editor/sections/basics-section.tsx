import { Group, Stack } from '@mantine/core';
import React from 'react';

import { FormCheckbox, FormTextarea } from '@ui/form-components';

const RequiredInfoTip =
	'Required operations must finish as "done". If they fail, the run will fail for the corresponding hook.';

type Props = {
	index: number;
};

export const BasicsSection: React.FC<Props> = ({ index }) => {
	return (
		<Stack gap="xs">
			<FormTextarea
				name={`operations.${index}.description`}
				label="Description"
				infoTip="Short description shown in list, node labels, and profile docs."
				textareaProps={{ minRows: 2, autosize: true }}
			/>

			<Group grow wrap="wrap">
				<FormCheckbox
					name={`operations.${index}.config.enabled`}
					label="Enabled"
					infoTip="Disabled operations are skipped and do not commit effects."
				/>
				<FormCheckbox name={`operations.${index}.config.required`} label="Required" infoTip={RequiredInfoTip} />
			</Group>
		</Stack>
	);
};

