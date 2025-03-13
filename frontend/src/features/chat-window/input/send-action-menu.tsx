import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from '@ui/chakra-core-ui/menu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuEllipsisVertical } from 'react-icons/lu';

export const SendActionMenu = () => {
	return (
		<MenuRoot>
			<MenuTrigger asChild>
				<IconButtonWithTooltip tooltip="menu" icon={<LuEllipsisVertical />} />
			</MenuTrigger>
			<MenuContent>
				<MenuItem value="send-as-user">Send ad User</MenuItem>
				<MenuItem value="send-as-assistant">Send as Assistant</MenuItem>
				<MenuItem value="send-as-system">Send as System</MenuItem>
			</MenuContent>
		</MenuRoot>
	);
};
