import { Menu } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LuEllipsisVertical } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { Z_INDEX } from '@ui/z-index';

export const SendActionMenu = () => {
	const { t } = useTranslation();

	return (
		<Menu withinPortal zIndex={Z_INDEX.overlay.popup} position="top-end">
			<Menu.Target>
				<span>
					<IconButtonWithTooltip tooltip={t('chat.input.actions')} icon={<LuEllipsisVertical />} aria-label={t('chat.input.actions')} />
				</span>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Item>Send as User</Menu.Item>
				<Menu.Item>Send as Assistant</Menu.Item>
				<Menu.Item>Send as System</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
};
