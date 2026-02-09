import { Menu } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LuEllipsisVertical } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

export const SendActionMenu = () => {
	const { t } = useTranslation();

	return (
		<Menu withinPortal zIndex={4000} position="top-end">
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
