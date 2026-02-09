import { Avatar, Card, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

import { deleteEntityProfileRequested, selectEntityProfile } from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { BACKEND_ORIGIN } from '../../../api/chat-core';

import type { EntityProfileDto } from '../../../api/chat-core';

type Props = {
	data: EntityProfileDto;
};

export const AgentCard: React.FC<Props> = ({ data }) => {
	const { t } = useTranslation();
	const handleSelect = () => {
		selectEntityProfile(data);
	};

	const avatarSrc = data.avatarAssetId ? `${BACKEND_ORIGIN}${data.avatarAssetId}` : undefined;

	return (
		<Card withBorder padding="md" onClick={handleSelect} className="ts-sidebar-card" style={{ cursor: 'pointer', position: 'relative' }}>
			<Group gap="sm" wrap="nowrap" align="flex-start">
				<Avatar size="lg" name={data.name} src={avatarSrc} />
				<Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
					<Text fw={600} truncate>
						{data.name}
					</Text>

					<Text c="dimmed" size="xs" lineClamp={2}>
						{t('agentCards.kindLabel', { kind: data.kind })}
					</Text>
				</Stack>
				<IconButtonWithTooltip
					tooltip={t('common.delete')}
					variant="ghost"
					size="sm"
					colorPalette="red"
					aria-label={t('common.delete')}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						if (!window.confirm(t('agentCards.confirm.deleteProfile', { name: data.name }))) return;
						deleteEntityProfileRequested({ id: data.id });
					}}
					icon={<LuTrash2 />}
				/>
			</Group>
		</Card>
	);
};
