import { Flex } from '@chakra-ui/react';
import { changeSidebarSettings } from '@model/sidebars';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuCode, LuIdCard, LuSettings, LuSquareUser } from 'react-icons/lu';

export const LeftBar = () => {
	return (
		<>
			<Flex
				direction="column"
				w="70px"
				position="fixed"
				left={0}
				top={0}
				h="100vh"
				bg="white"
				pt={4}
				gap={4}
				align="center"
			>
				<div>
					<IconButtonWithTooltip
						tooltip="Chat cards"
						variant="outline"
						size="lg"
						colorScheme="purple"
						aria-label="Open chat cards"
						onClick={() => changeSidebarSettings({ name: 'chatCards', settings: { isOpen: true } })}
						icon={<LuIdCard />}
					/>
				</div>
				<div>
					<IconButtonWithTooltip
						tooltip="Settings"
						variant="outline"
						colorScheme="purple"
						aria-label="Open settings"
						size="lg"
						onClick={() => changeSidebarSettings({ name: 'settings', settings: { isOpen: true } })}
						icon={<LuSettings />}
					/>
				</div>
				<div>
					<IconButtonWithTooltip
						tooltip="User persons"
						variant="outline"
						size="lg"
						colorScheme="purple"
						aria-label="Open user persons"
						onClick={() => changeSidebarSettings({ name: 'userPersons', settings: { isOpen: true } })}
						icon={<LuSquareUser />}
					/>
				</div>
				<div>
					<IconButtonWithTooltip
						tooltip="Pipeline"
						variant="outline"
						colorScheme="purple"
						aria-label="Open pipeline"
						size="lg"
						onClick={() => changeSidebarSettings({ name: 'pipeline', settings: { isOpen: true } })}
						icon={<LuCode />}
					/>
				</div>
			</Flex>
		</>
	);
};
