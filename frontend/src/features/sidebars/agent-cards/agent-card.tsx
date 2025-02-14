import { Badge, Card, HStack, Stack, Text, Wrap } from '@chakra-ui/react';

import { Avatar } from '@ui/chakra-core-ui/avatar';
import { LuPencil, LuTrash2, LuCopy } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { chatListModel } from '@model/chat-list';
import { setCurrentAgentCard } from '@model/chat-service';
import { AgentCard as AgentCardType } from '@shared/types/agent-card';
import { AuthorNoteDialog } from './components/author-note-dialog';
import { setSelectedAgentCardForEdit, setIsEditAgentCardModalOpen } from '@model/chat-list';

type Props = {
	data: AgentCardType;
};

export const AgentCard: React.FC<Props> = ({ data }) => {
	const handleSelect = () => {
		setCurrentAgentCard(data);
	};

	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setSelectedAgentCardForEdit(data);
		setIsEditAgentCardModalOpen(true);
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
			_hover={{ cursor: 'pointer', borderColor: 'purple.600' }}
			position="relative"
		>
			<Card.Body p={4}>
				<HStack gap="2">
					<Avatar size="lg" src={`http://localhost:5000${data.avatarPath}`} name={data.title} alignSelf="flex-start" />
					<Stack gap="2">
						<Text fontWeight="semibold" textStyle="md">
							{data.name}
						</Text>

						<Text color="fg.muted" textStyle="xs" lineClamp={2}>
							{data.metadata?.creator_notes}
						</Text>

						{data.metadata?.tags && (
							<Wrap gap="1">
								{data.metadata.tags.map((item: string) => (
									<Badge variant="outline" key={item}>
										{item}
									</Badge>
								))}
							</Wrap>
						)}
					</Stack>
					<HStack position="absolute" top="2" right="2" gap="1">
						<AuthorNoteDialog note={data.metadata?.creator_notes} name={data.name} avatar={data.avatarPath} />
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
