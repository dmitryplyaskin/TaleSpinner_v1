import { Card, HStack, Stack, Text } from '@chakra-ui/react';

import { Avatar } from '@ui/chakra-core-ui/avatar';
import { LuPencil, LuTrash2, LuCopy } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { chatListModel } from '@model/chat-list';
import { setCurrentAgentCard } from '@model/chat-service';
import { AgentCard } from '@shared/types/agent-card';

type Props = {
	data: AgentCard;
};

export const CharacterCard: React.FC<Props> = ({ data }) => {
	const handleSelect = () => {
		setCurrentAgentCard(data);
	};

	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		// openEditModal(data);
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		chatListModel.deleteItemFx(data.id);
	};

	const handleDuplicateClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		chatListModel.duplicateItemFx(data);
	};

	return (
		<Card.Root
			w="100%"
			onClick={handleSelect}
			_hover={{ cursor: 'pointer', backgroundColor: 'purple.50' }}
			position="relative"
		>
			<Card.Body>
				<HStack gap="3">
					<Avatar src={`http://localhost:5000${data.imagePath}`} name={data.title} />
					<Stack gap="0">
						<Text fontWeight="semibold" textStyle="sm">
							{data.title}
						</Text>
						<Text color="fg.muted" textStyle="sm">
							last msg in chat
						</Text>
					</Stack>
					<HStack position="absolute" top="2" right="2" gap="1">
						<IconButtonWithTooltip
							aria-label="Дублировать чат"
							variant="ghost"
							size="sm"
							tooltip="Дублировать чат"
							onClick={handleDuplicateClick}
							icon={<LuCopy />}
						/>
						<IconButtonWithTooltip
							aria-label="Редактировать чат"
							variant="ghost"
							size="sm"
							tooltip="Редактировать чат"
							onClick={handleEditClick}
							icon={<LuPencil />}
						/>
						<IconButtonWithTooltip
							aria-label="Удалить чат"
							variant="ghost"
							size="sm"
							tooltip="Удалить чат"
							onClick={handleDeleteClick}
							icon={<LuTrash2 />}
						/>
					</HStack>
				</HStack>
			</Card.Body>
		</Card.Root>
	);
};
