import { Box, Stack } from '@mantine/core';
import { type IconType } from 'react-icons';
import { LuIdCard, LuSettings, LuSquareUser, LuFileText, LuFileCode2, LuSettings2, LuWorkflow } from 'react-icons/lu';

import { toggleSidebarOpen } from '@model/sidebars';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';


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
		name: 'operationProfiles',
		tooltip: 'Operations',
		icon: LuWorkflow,
		ariaLabel: 'Open operations',
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
		<Box
			style={{
				width: 70,
				position: 'fixed',
				left: 0,
				top: 0,
				height: '100vh',
				background: 'white',
				paddingTop: 16,
				zIndex: 2,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 16,
			}}
		>
			<Stack gap="md" style={{ flex: 1 }}>
				{sidebarButtons.map((button) => (
					<Box key={button.name}>
						<IconButtonWithTooltip
							tooltip={button.tooltip}
							variant="outline"
							size="lg"
							colorPalette="purple"
							aria-label={button.ariaLabel}
							onClick={() => toggleSidebarOpen({ name: button.name, isOpen: true })}
							icon={<button.icon />}
						/>
					</Box>
				))}
			</Stack>
			<Box pb={16}>
				<IconButtonWithTooltip
					tooltip={appSettingsButton.tooltip}
					variant="outline"
					size="lg"
					colorPalette="gray"
					aria-label={appSettingsButton.ariaLabel}
					onClick={() => toggleSidebarOpen({ name: appSettingsButton.name, isOpen: true })}
					icon={<appSettingsButton.icon />}
				/>
			</Box>
		</Box>
	);
};
