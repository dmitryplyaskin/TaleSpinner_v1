import { Avatar, Badge, Box, Card, Group, Stack, Text } from '@mantine/core';
import { type AgentCard as AgentCardType } from '@shared/types/agent-card';
import type { MouseEvent } from 'react';
import { LuPencil, LuTrash2, LuCopy } from 'react-icons/lu';

import { agentCardsModel , setSelectedAgentCardForEdit, setIsEditAgentCardModalOpen } from '@model/agent-cards';
import { setCurrentAgentCard } from '@model/chat-service';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';


import { AuthorNoteDialog } from './components/author-note-dialog';


type Props = {
	data: AgentCardType;
};

export const AgentCard: React.FC<Props> = ({ data }) => {
	const handleSelect = () => {
		setCurrentAgentCard(data);
	};

	const handleEditClick = (e: MouseEvent) => {
		e.stopPropagation();
		setSelectedAgentCardForEdit(data);
		setIsEditAgentCardModalOpen(true);
	};

	const handleDeleteClick = (e: MouseEvent) => {
		e.stopPropagation();
		agentCardsModel.deleteItemFx(data.id);
	};

	const handleDuplicateClick = (e: MouseEvent) => {
		e.stopPropagation();
		agentCardsModel.duplicateItemFx(data);
	};

	return (
		<Card withBorder padding="md" onClick={handleSelect} style={{ cursor: 'pointer', position: 'relative' }}>
			<Group gap="sm" wrap="nowrap" align="flex-start">
				<Avatar
					size="lg"
					src={data.avatarPath ? `http://localhost:5000${data.avatarPath}` : undefined}
					name={data.title}
				/>
				<Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
					<Text fw={600} truncate>
						{data.name}
					</Text>

					<Text c="dimmed" size="xs" lineClamp={2}>
						{data.metadata?.creator_notes}
					</Text>

					{data.metadata?.tags && (
						<Group gap={4} wrap="wrap">
							{data.metadata.tags.map((item: string) => (
								<Badge variant="outline" key={item}>
									{item}
								</Badge>
							))}
						</Group>
					)}
				</Stack>

				<Box style={{ position: 'absolute', top: 8, right: 8 }}>
					<Group gap={4} wrap="nowrap">
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
					</Group>
				</Box>
			</Group>
		</Card>
	);
};
