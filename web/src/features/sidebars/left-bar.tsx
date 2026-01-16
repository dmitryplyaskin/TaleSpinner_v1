import { Box, Flex } from '@chakra-ui/react';
import { toggleSidebarOpen } from '@model/sidebars';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuCode, LuIdCard, LuSettings, LuSquareUser, LuFileText, LuFileCode2, LuSettings2 } from 'react-icons/lu';
import { IconType } from 'react-icons';
import type { SidebarName } from '@model/sidebars';

type SidebarButton = {
	name: SidebarName;
	tooltip: string;
	icon: IconType;
	ariaLabel: string;
};

const sidebarButtons: SidebarButton[] = [
	{
		name: 'agentCards',
		tooltip: 'Chat cards',
		icon: LuIdCard,
		ariaLabel: 'Open chat cards',
	},
	{
		name: 'settings',
		tooltip: 'Settings',
		icon: LuSettings,
		ariaLabel: 'Open settings',
	},
	{
		name: 'userPersons',
		tooltip: 'User persons',
		icon: LuSquareUser,
		ariaLabel: 'Open user persons',
	},
	{
		name: 'instructions',
		tooltip: 'Instructions',
		icon: LuFileText,
		ariaLabel: 'Open instructions',
	},
	{
		name: 'templates',
		tooltip: 'Templates',
		icon: LuFileCode2,
		ariaLabel: 'Open templates',
	},
	{
		name: 'pipeline',
		tooltip: 'Pipeline',
		icon: LuCode,
		ariaLabel: 'Open pipeline',
	},
] as const;

const appSettingsButton: SidebarButton = {
	name: 'appSettings',
	tooltip: 'Настройки приложения',
	icon: LuSettings2,
	ariaLabel: 'Open app settings',
};

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
			<Flex direction="column" gap={4} flex={1}>
				{sidebarButtons.map((button) => (
					<Box key={button.name}>
						<IconButtonWithTooltip
							tooltip={button.tooltip}
							variant="outline"
							size="lg"
							colorScheme="purple"
							aria-label={button.ariaLabel}
							onClick={() => toggleSidebarOpen({ name: button.name, isOpen: true })}
							icon={<button.icon />}
						/>
					</Box>
				))}
			</Flex>
			<Box pb={4}>
				<IconButtonWithTooltip
					tooltip={appSettingsButton.tooltip}
					variant="outline"
					size="lg"
					colorScheme="gray"
					aria-label={appSettingsButton.ariaLabel}
					onClick={() => toggleSidebarOpen({ name: appSettingsButton.name, isOpen: true })}
					icon={<appSettingsButton.icon />}
				/>
			</Box>
		</Flex>
	);
};
