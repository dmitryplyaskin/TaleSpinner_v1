import { Box, Flex, Paper } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { ArrowUUpLeftIcon, CheckIcon, DotsThreeIcon, EyeIcon, EyeSlashIcon, FileMagnifyingGlassIcon, ListBulletsIcon, PencilSimpleIcon, TrashIcon, XIcon } from '@ui/icons';


type ActionBarProps = {
	isEditing: boolean;
	canDeleteVariant: boolean;
	isPromptExcluded: boolean;
	showPromptInspectorAction: boolean;
	canOpenPromptInspector: boolean;
	showUndoCanonicalizationAction: boolean;
	canOpenUndoCanonicalization: boolean;
	onTogglePromptVisibility: () => void;
	onOpenPromptInspector: () => void;
	onOpenUndoCanonicalization: () => void;
	onOpenPartsEditor: () => void;
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
	showPromptInspectorAction,
	canOpenPromptInspector,
	showUndoCanonicalizationAction,
	canOpenUndoCanonicalization,
	onTogglePromptVisibility,
	onOpenPromptInspector,
	onOpenUndoCanonicalization,
	onOpenPartsEditor,
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

	const hiddenActionsCount =
		(canDeleteVariant ? 1 : 0) + 3 + (showPromptInspectorAction ? 1 : 0) + (showUndoCanonicalizationAction ? 1 : 0);
	const expandedWidth = hiddenActionsCount > 0 ? hiddenActionsCount * 26 - 4 : 0;

	return (
		<Flex gap={6} align="center">
			{isEditing ? (
				<Flex gap={4}>
					<IconButtonWithTooltip size="sm" variant="solid" colorPalette="red" icon={<XIcon />} tooltip={t('chat.actions.cancelEdit')} aria-label={t('chat.actions.cancelEdit')} onClick={onCancelEdit} />
					<IconButtonWithTooltip size="sm" variant="solid" colorPalette="green" icon={<CheckIcon />} tooltip={t('chat.actions.confirmEdit')} aria-label={t('chat.actions.confirmEdit')} onClick={onConfirmEdit} />
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
										size="sm"
										variant="ghost"
										colorPalette="red"
										icon={<TrashIcon />}
										tooltip={t('chat.variants.delete')}
										aria-label={t('chat.variants.delete')}
										onClick={() => {
											setActionsOpen(false);
											onRequestDeleteVariant();
										}}
									/>
								)}
								<IconButtonWithTooltip
									size="sm"
									variant="ghost"
									colorPalette="red"
									icon={<TrashIcon />}
									tooltip={t('chat.actions.deleteMessage')}
									aria-label={t('chat.actions.deleteMessage')}
									onClick={() => {
										setActionsOpen(false);
										onRequestDeleteMessage();
									}}
								/>
								<IconButtonWithTooltip
									size="sm"
									variant="ghost"
									colorPalette={isPromptExcluded ? 'gray' : 'cyan'}
									icon={isPromptExcluded ? <EyeIcon /> : <EyeSlashIcon />}
									tooltip={isPromptExcluded ? t('chat.actions.showInPrompt') : t('chat.actions.hideFromPrompt')}
									aria-label={isPromptExcluded ? t('chat.actions.showInPrompt') : t('chat.actions.hideFromPrompt')}
									onClick={() => {
										setActionsOpen(false);
										onTogglePromptVisibility();
									}}
								/>
								{showUndoCanonicalizationAction && (
									<IconButtonWithTooltip
										size="sm"
										variant="ghost"
										colorPalette={canOpenUndoCanonicalization ? 'orange' : 'gray'}
										icon={<ArrowUUpLeftIcon />}
										tooltip={
											canOpenUndoCanonicalization
												? t('chat.actions.undoCanonicalization')
												: t('chat.actions.undoCanonicalizationUnavailable')
										}
										aria-label={t('chat.actions.undoCanonicalization')}
										onClick={() => {
											if (!canOpenUndoCanonicalization) return;
											setActionsOpen(false);
											onOpenUndoCanonicalization();
										}}
									/>
								)}
								{showPromptInspectorAction && (
									<IconButtonWithTooltip
										size="sm"
										variant="ghost"
										colorPalette={canOpenPromptInspector ? 'cyan' : 'gray'}
										icon={<FileMagnifyingGlassIcon />}
										tooltip={
											canOpenPromptInspector
												? t('chat.actions.viewPrompt')
												: t('chat.actions.viewPromptUnavailable')
										}
										aria-label={t('chat.actions.viewPrompt')}
										onClick={() => {
											if (!canOpenPromptInspector) return;
											setActionsOpen(false);
											onOpenPromptInspector();
										}}
									/>
								)}
								<IconButtonWithTooltip
									size="sm"
									variant="ghost"
									colorPalette="teal"
									icon={<ListBulletsIcon />}
									tooltip={t('chat.actions.openPartsEditor')}
									aria-label={t('chat.actions.openPartsEditor')}
									onClick={() => {
										setActionsOpen(false);
										onOpenPartsEditor();
									}}
								/>
							</Flex>
						</Box>
						<IconButtonWithTooltip
							size="sm"
							variant="ghost"
							colorPalette="gray"
							icon={<DotsThreeIcon />}
							tooltip={actionsOpen ? t('chat.actions.hideActions') : t('chat.actions.showActions')}
							aria-label={actionsOpen ? t('chat.actions.hideActions') : t('chat.actions.showActions')}
							active={actionsOpen}
							onClick={() => setActionsOpen((prev) => !prev)}
						/>
						<IconButtonWithTooltip
							size="sm"
							variant="ghost"
							colorPalette="violet"
							icon={<PencilSimpleIcon />}
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
