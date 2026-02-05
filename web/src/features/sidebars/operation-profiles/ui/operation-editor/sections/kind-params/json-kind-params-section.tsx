import { Stack, Text } from '@mantine/core';
import React from 'react';

import { FormTextarea } from '@ui/form-components';

type Props = {
	index: number;
	kindLabel: string;
	description: string;
	placeholder: string;
};

export const JsonKindParamsSection: React.FC<Props> = ({ index, kindLabel, description, placeholder }) => {
	return (
		<Stack gap="xs">
			<Text size="sm" c="dimmed">
				{description}
			</Text>
			<FormTextarea
				name={`operations.${index}.config.params.paramsJson`}
				label={`${kindLabel} params (JSON)`}
				infoTip="Kind params are saved as a JSON object in config.params.params."
				textareaProps={{ minRows: 8, autosize: true, placeholder }}
			/>
		</Stack>
	);
};
