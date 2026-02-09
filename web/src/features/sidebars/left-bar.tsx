import { Box } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';
import { type IconType } from 'react-icons';
import { LuBookOpen, LuFileCode2, LuFileText, LuIdCard, LuSettings, LuSettings2, LuSquareUser, LuWorkflow } from 'react-icons/lu';

import { $sidebars, toggleSidebarOpen, type SidebarName } from '@model/sidebars';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type SidebarButton = {
	name: SidebarName;
	labelKey: string;
	icon: IconType;
};

const sidebarButtons: SidebarButton[] = [
	{ name: 'agentCards', labelKey: 'leftRail.agentCards', icon: LuIdCard },
	{ name: 'settings', labelKey: 'leftRail.settings', icon: LuSettings },
	{ name: 'userPersons', labelKey: 'leftRail.userPersons', icon: LuSquareUser },
	{ name: 'instructions', labelKey: 'leftRail.instructions', icon: LuFileText },
	{ name: 'templates', labelKey: 'leftRail.templates', icon: LuFileCode2 },
	{ name: 'worldInfo', labelKey: 'leftRail.worldInfo', icon: LuBookOpen },
	{ name: 'operationProfiles', labelKey: 'leftRail.operationProfiles', icon: LuWorkflow },
];

const appSettingsButton: SidebarButton = {
	name: 'appSettings',
	labelKey: 'leftRail.appSettings',
	icon: LuSettings2,
};

export const LeftBar = () => {
	const { t } = useTranslation();
	const sidebars = useUnit($sidebars);

	const renderButton = (button: SidebarButton) => {
		const section = t(button.labelKey);
		const isActive = Boolean(sidebars[button.name]?.isOpen);

		return (
			<Box key={button.name} className="ts-rail-button-wrap" data-active={isActive}>
				<IconButtonWithTooltip
					tooltip={section}
					variant="ghost"
					size="md"
					radius="sm"
					iconSize={16}
					colorPalette="gray"
					active={isActive}
					aria-label={t('leftRail.open', { section })}
					onClick={() => toggleSidebarOpen({ name: button.name, isOpen: true })}
					icon={<button.icon />}
				/>
			</Box>
		);
	};

	return (
		<Box className="ts-left-rail">
			<Box className="ts-left-rail__top">{sidebarButtons.map(renderButton)}</Box>
			<Box className="ts-left-rail__bottom">{renderButton(appSettingsButton)}</Box>
		</Box>
	);
};
