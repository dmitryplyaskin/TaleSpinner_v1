import { LuEllipsisVertical } from 'react-icons/lu';

import { Menu } from '@mantine/core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

export const SendActionMenu = () => {
	return (
		<Menu withinPortal zIndex={4000} position="top-end">
			<Menu.Target>
				<span>
					<IconButtonWithTooltip tooltip="menu" icon={<LuEllipsisVertical />} aria-label="send actions" />
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
