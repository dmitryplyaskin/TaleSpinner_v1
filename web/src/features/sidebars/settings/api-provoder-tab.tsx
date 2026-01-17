import { VStack } from '@chakra-ui/react';

import { ProviderPicker } from '../../llm-provider/provider-picker';

export const APIProviderTab = () => {
	return (
		<VStack gap={6} align="stretch">
			<ProviderPicker scope="global" scopeId="global" />
		</VStack>
	);
};
