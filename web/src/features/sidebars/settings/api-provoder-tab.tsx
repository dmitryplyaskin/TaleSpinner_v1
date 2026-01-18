import { Stack } from '@mantine/core';

import { ProviderPicker } from '../../llm-provider/provider-picker';

export const APIProviderTab = () => {
	return (
		<Stack gap="md">
			<ProviderPicker scope="global" scopeId="global" />
		</Stack>
	);
};
