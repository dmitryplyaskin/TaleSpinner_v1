import { Box, Flex } from '@chakra-ui/react';
import { changeSidebarSettings } from '@model/sidebars';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuCode, LuIdCard, LuSettings, LuSquareUser, LuFileText, LuFileCode2 } from 'react-icons/lu';

export const LeftBar = () => {
	return (
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
			zIndex={2}
		>
			<Box>
				<IconButtonWithTooltip
					tooltip="Chat cards"
					variant="outline"
					size="lg"
					colorScheme="purple"
					aria-label="Open chat cards"
					onClick={() => changeSidebarSettings({ name: 'agentCards', settings: { isOpen: true } })}
					icon={<LuIdCard />}
				/>
			</Box>
			<Box>
				<IconButtonWithTooltip
					tooltip="Settings"
					variant="outline"
					colorScheme="purple"
					aria-label="Open settings"
					size="lg"
					onClick={() => changeSidebarSettings({ name: 'settings', settings: { isOpen: true } })}
					icon={<LuSettings />}
				/>
			</Box>
			<Box>
				<IconButtonWithTooltip
					tooltip="User persons"
					variant="outline"
					size="lg"
					colorScheme="purple"
					aria-label="Open user persons"
					onClick={() => changeSidebarSettings({ name: 'userPersons', settings: { isOpen: true } })}
					icon={<LuSquareUser />}
				/>
			</Box>
			<Box>
				<IconButtonWithTooltip
					tooltip="Instructions"
					variant="outline"
					size="lg"
					colorScheme="purple"
					aria-label="Open instructions"
					onClick={() => changeSidebarSettings({ name: 'instructions', settings: { isOpen: true } })}
					icon={<LuFileText />}
				/>
			</Box>
			<Box>
				<IconButtonWithTooltip
					tooltip="Templates"
					variant="outline"
					colorScheme="purple"
					aria-label="Open templates"
					size="lg"
					onClick={() => changeSidebarSettings({ name: 'templates', settings: { isOpen: true } })}
					icon={<LuFileCode2 />}
				/>
			</Box>
			<Box>
				<IconButtonWithTooltip
					tooltip="Pipeline"
					variant="outline"
					colorScheme="purple"
					aria-label="Open pipeline"
					size="lg"
					onClick={() => changeSidebarSettings({ name: 'pipeline', settings: { isOpen: true } })}
					icon={<LuCode />}
				/>
			</Box>
		</Flex>
	);
};
