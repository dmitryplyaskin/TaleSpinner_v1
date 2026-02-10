import { Box, Flex, Paper } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuEllipsis, LuEye, LuEyeOff, LuPen, LuTrash, LuX } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

type ActionBarProps = {
	isEditing: boolean;
	canDeleteVariant: boolean;
	isPromptExcluded: boolean;
	onTogglePromptVisibility: () => void;
	onOpenEdit: () => void;
	onCancelEdit: () => void;
	onConfirmEdit: () => void;
	onRequestDeleteMessage: () => void;
	onRequestDeleteVariant: () => void;
};

export const ActionBar = ({
	isEditing,
	canDeleteVariant,
	isPromptExcluded,
	onTogglePromptVisibility,
	onOpenEdit,
	onCancelEdit,
	onConfirmEdit,
	onRequestDeleteMessage,
	onRequestDeleteVariant,
}: ActionBarProps) => {
	const { t } = useTranslation();
	const [actionsOpen, setActionsOpen] = useState(false);

	useEffect(() => {
		if (isEditing) setActionsOpen(false);
	}, [isEditing]);

	const expandedWidth = canDeleteVariant ? 74 : 48;

	return (
		<Flex gap={6} align="center">
			{isEditing ? (
				<Flex gap={4}>
					<IconButtonWithTooltip size="xs" variant="solid" colorPalette="red" icon={<LuX />} tooltip={t('chat.actions.cancelEdit')} aria-label={t('chat.actions.cancelEdit')} onClick={onCancelEdit} />
					<IconButtonWithTooltip size="xs" variant="solid" colorPalette="green" icon={<LuCheck />} tooltip={t('chat.actions.confirmEdit')} aria-label={t('chat.actions.confirmEdit')} onClick={onConfirmEdit} />
				</Flex>
			) : (
				<Paper withBorder radius="md" p={6} style={{ borderColor: 'var(--ts-border-soft)', backgroundColor: 'var(--ts-surface-elevated)' }}>
					<Flex gap={3} align="center" wrap="nowrap">
						<Box
							style={{
								width: actionsOpen ? expandedWidth : 0,
								overflow: 'hidden',
								transition: 'width 160ms ease',
							}}
						>
							<Flex gap={4} align="center" wrap="nowrap">
								{canDeleteVariant && (
									<IconButtonWithTooltip
										size="xs"
										variant="ghost"
										colorPalette="red"
										icon={<LuTrash />}
										tooltip={t('chat.variants.delete')}
										aria-label={t('chat.variants.delete')}
										onClick={() => {
											setActionsOpen(false);
											onRequestDeleteVariant();
										}}
									/>
								)}
								<IconButtonWithTooltip
									size="xs"
									variant="ghost"
									colorPalette="red"
									icon={<LuTrash />}
									tooltip={t('chat.actions.deleteMessage')}
									aria-label={t('chat.actions.deleteMessage')}
									onClick={() => {
										setActionsOpen(false);
										onRequestDeleteMessage();
									}}
								/>
								<IconButtonWithTooltip
									size="xs"
									variant="ghost"
									colorPalette={isPromptExcluded ? 'gray' : 'cyan'}
									icon={isPromptExcluded ? <LuEye /> : <LuEyeOff />}
									tooltip={isPromptExcluded ? t('chat.actions.showInPrompt') : t('chat.actions.hideFromPrompt')}
									aria-label={isPromptExcluded ? t('chat.actions.showInPrompt') : t('chat.actions.hideFromPrompt')}
									onClick={() => {
										setActionsOpen(false);
										onTogglePromptVisibility();
									}}
								/>
							</Flex>
						</Box>
						<IconButtonWithTooltip
							size="xs"
							variant="ghost"
							colorPalette="gray"
							icon={<LuEllipsis />}
							tooltip={actionsOpen ? t('chat.actions.hideActions') : t('chat.actions.showActions')}
							aria-label={actionsOpen ? t('chat.actions.hideActions') : t('chat.actions.showActions')}
							active={actionsOpen}
							onClick={() => setActionsOpen((prev) => !prev)}
						/>
						<IconButtonWithTooltip
							size="xs"
							variant="ghost"
							colorPalette="violet"
							icon={<LuPen />}
							tooltip={t('chat.actions.editMessage')}
							aria-label={t('chat.actions.editMessage')}
							onClick={onOpenEdit}
						/>
					</Flex>
				</Paper>
			)}
		</Flex>
	);
};
