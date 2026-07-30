import { Box } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';


import { $sidebars, toggleSidebarOpen, type SidebarName } from '@model/sidebars';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { BookOpenIcon, FileTextIcon, FlowArrowIcon, GearIcon, IdentificationCardIcon, SlidersHorizontalIcon, UserSquareIcon, UsersIcon, type Icon } from '@ui/icons';

import { AccountManager } from '../auth/account-manager';

type SidebarButton = {
	name: SidebarName;
	labelKey: string;
	icon: Icon;
};

const sidebarButtons: SidebarButton[] = [
	{ name: 'agentCards', labelKey: 'leftRail.agentCards', icon: IdentificationCardIcon },
	{ name: 'settings', labelKey: 'leftRail.settings', icon: GearIcon },
	{ name: 'userPersons', labelKey: 'leftRail.userPersons', icon: UserSquareIcon },
	{ name: 'instructions', labelKey: 'leftRail.instructions', icon: FileTextIcon },
	{ name: 'worldInfo', labelKey: 'leftRail.worldInfo', icon: BookOpenIcon },
	{ name: 'operationProfiles', labelKey: 'leftRail.operationProfiles', icon: FlowArrowIcon },
];

const appSettingsButton: SidebarButton = {
	name: 'appSettings',
	labelKey: 'leftRail.appSettings',
	icon: SlidersHorizontalIcon,
};

export const LeftBar = () => {
	const { t } = useTranslation();
	const sidebars = useUnit($sidebars);
	const [accountsOpened, setAccountsOpened] = useState(false);

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
		<>
			<Box className="ts-left-rail">
				<Box className="ts-left-rail__top">{sidebarButtons.map(renderButton)}</Box>
				<Box className="ts-left-rail__bottom">
					<IconButtonWithTooltip
						tooltip={t('auth.accounts.title')}
						aria-label={t('auth.accounts.title')}
						icon={<UsersIcon />}
						variant="ghost"
						onClick={() => setAccountsOpened(true)}
					/>
					{renderButton(appSettingsButton)}
				</Box>
			</Box>
			<AccountManager opened={accountsOpened} onClose={() => setAccountsOpened(false)} />
		</>
	);
};
