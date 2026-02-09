import { Avatar, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LuPencil, LuStar, LuTrash2 } from 'react-icons/lu';

import { selectEntityProfile } from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { BACKEND_ORIGIN } from '../../../api/chat-core';

import { estimateTokens, getSpecSummary, parseSpec } from './spec-utils';

import type { EntityProfileDto } from '../../../api/chat-core';

type Props = {
	data: EntityProfileDto;
	isActive: boolean;
	favoritePending: boolean;
	onEdit: (profile: EntityProfileDto) => void;
	onDelete: (profile: EntityProfileDto) => void;
	onToggleFavorite: (profile: EntityProfileDto) => void;
};

export const AgentCard = ({ data, isActive, favoritePending, onEdit, onDelete, onToggleFavorite }: Props) => {
	const { t } = useTranslation();
	const handleSelect = () => {
		selectEntityProfile(data);
	};
	const parsedSpec = parseSpec(data.spec);
	const summary = getSpecSummary(parsedSpec);
	const tokens = estimateTokens(parsedSpec);
	const tags = parsedSpec.tags.slice(0, 6);
	const hiddenTagsCount = Math.max(0, parsedSpec.tags.length - tags.length);

	const avatarSrc = data.avatarAssetId ? `${BACKEND_ORIGIN}${data.avatarAssetId}` : undefined;

	return (
		<Card
			withBorder
			padding="md"
			onClick={handleSelect}
			className="ts-sidebar-card"
			style={{
				cursor: 'pointer',
				position: 'relative',
				borderColor: isActive ? 'var(--mantine-color-cyan-6)' : undefined,
				boxShadow: isActive ? '0 0 0 2px var(--ts-accent-soft)' : undefined,
			}}
		>
			<Group gap="sm" wrap="nowrap" align="flex-start">
				<Avatar size="lg" name={data.name} src={avatarSrc} />
				<Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
					<Group gap={6} wrap="nowrap">
						<Text fw={600} truncate>
							{data.name}
						</Text>
						{isActive && (
							<Badge size="xs" color="cyan" variant="light">
								{t('agentCards.badges.active')}
							</Badge>
						)}
						{parsedSpec.sourceSpecVersion && (
							<Badge size="xs" variant="outline">
								v{parsedSpec.sourceSpecVersion}
							</Badge>
						)}
					</Group>

					<Text c="dimmed" size="xs">
						{t('agentCards.tokensApprox', { count: tokens })}
					</Text>

					{summary.length > 0 ? (
						<Text c="dimmed" size="xs" lineClamp={2}>
							{summary}
						</Text>
					) : (
						<Text c="dimmed" size="xs" lineClamp={1}>
							{t('agentCards.kindLabel', { kind: data.kind })}
						</Text>
					)}

					{tags.length > 0 && (
						<Group gap={4}>
							{tags.map((tag) => (
								<Badge key={tag} size="xs" variant="light" color="gray">
									{tag}
								</Badge>
							))}
							{hiddenTagsCount > 0 && (
								<Badge size="xs" variant="outline">
									+{hiddenTagsCount}
								</Badge>
							)}
						</Group>
					)}
				</Stack>
				<IconButtonWithTooltip
					tooltip={t('common.edit')}
					variant="ghost"
					size="sm"
					aria-label={t('common.edit')}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onEdit(data);
					}}
					icon={<LuPencil />}
				/>
				<IconButtonWithTooltip
					tooltip={data.isFavorite ? t('agentCards.actions.unfavorite') : t('agentCards.actions.favorite')}
					variant="ghost"
					size="sm"
					colorPalette={data.isFavorite ? 'yellow' : undefined}
					aria-label={data.isFavorite ? t('agentCards.actions.unfavorite') : t('agentCards.actions.favorite')}
					active={data.isFavorite}
					disabled={favoritePending}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onToggleFavorite(data);
					}}
					icon={<LuStar />}
				/>
				<IconButtonWithTooltip
					tooltip={t('common.delete')}
					variant="ghost"
					size="sm"
					colorPalette="red"
					aria-label={t('common.delete')}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete(data);
					}}
					icon={<LuTrash2 />}
				/>
			</Group>
		</Card>
	);
};
