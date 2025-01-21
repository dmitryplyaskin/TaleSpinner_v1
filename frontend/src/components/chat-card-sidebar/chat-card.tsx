import { Card, HStack, Stack, Text } from '@chakra-ui/react';
import { selectChat } from '@model/chats';
import { ChatCard } from '../../types/chat';
import { Avatar } from '@ui/chakra-core-ui/avatar';
import { LuPencil } from 'react-icons/lu';
import { useState } from 'react';
import { EditChatModal } from './edit-chat-modal';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type Props = {
	data: ChatCard;
};

export const CharacterCard: React.FC<Props> = ({ data }) => {
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const handleSelect = () => {
		selectChat(data);
	};

	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsEditModalOpen(true);
	};

	return (
		<>
			<Card.Root
				w="100%"
				onClick={handleSelect}
				_hover={{ cursor: 'pointer', backgroundColor: 'purple.50' }}
				position="relative"
			>
				<Card.Body>
					<HStack gap="3">
						<Avatar src={data.imagePath} name={data.title} />
						<Stack gap="0">
							<Text fontWeight="semibold" textStyle="sm">
								{data.title}
							</Text>
							<Text color="fg.muted" textStyle="sm">
								last msg in chat
							</Text>
						</Stack>
						<IconButtonWithTooltip
							aria-label="Редактировать чат"
							variant="ghost"
							size="sm"
							position="absolute"
							tooltip="Редактировать чат"
							top="2"
							right="2"
							onClick={handleEditClick}
							icon={<LuPencil />}
						/>
					</HStack>
				</Card.Body>
			</Card.Root>
			<EditChatModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} chat={data} />
		</>
	);
};
