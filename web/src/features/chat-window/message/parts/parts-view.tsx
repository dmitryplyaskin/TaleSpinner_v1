import { Box, Collapse, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuPen, LuTrash, LuX } from 'react-icons/lu';

import { $appDebugEnabled } from '@model/app-debug';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { getUiProjection } from './projection';
import { renderPart } from './renderers';

import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

type Props = {
	entry: Entry;
	variant: Variant | null;
	currentTurn: number;
	preferPlainText?: boolean;
	canMutateParts?: boolean;
	editingPartId?: string | null;
	draftText?: string;
	onDraftTextChange?: (next: string) => void;
	onCancelEditPart?: () => void;
	onConfirmEditPart?: () => void;
	onEditPart?: (part: Part) => void;
	onDeletePart?: (part: Part) => void;
};

function isEditablePart(part: Part): boolean {
	return (
		!part.softDeleted &&
		typeof part.payload === 'string' &&
		(part.payloadFormat === 'text' || part.payloadFormat === 'markdown')
	);
}

function estimateInitialEditRows(value: string): number {
	const lines = value.split(/\r?\n/).length;
	return Math.max(2, lines);
}

const PartsViewInner: React.FC<Props> = ({
	entry,
	variant,
	currentTurn,
	preferPlainText = false,
	canMutateParts = false,
	editingPartId = null,
	draftText = '',
	onDraftTextChange,
	onCancelEditPart,
	onConfirmEditPart,
	onEditPart,
	onDeletePart,
}) => {
	const { t } = useTranslation();
	const appDebugEnabled = useUnit($appDebugEnabled);
	const [debugUiEnabled, setDebugUiEnabled] = useState(false);
	const [inspectorOpen, setInspectorOpen] = useState(false);
	const [reasoningOpen, setReasoningOpen] = useState(false);

	const visible = getUiProjection(entry, variant, {
		currentTurn,
		debugEnabled: appDebugEnabled && debugUiEnabled,
	});
	const reasoningParts = visible.filter((p) => p.channel === 'reasoning');
	const mainParts = visible.filter((p) => p.channel !== 'reasoning');
	const hasReasoningContent = reasoningParts.some(
		(p) => typeof p.payload === 'string' && p.payload.trim().length > 0,
	);
	const allParts = variant?.parts ?? [];

	useEffect(() => {
		if (appDebugEnabled) return;
		setDebugUiEnabled(false);
		setInspectorOpen(false);
	}, [appDebugEnabled]);

	useEffect(() => {
		if (hasReasoningContent) return;
		setReasoningOpen(false);
	}, [hasReasoningContent]);

	const renderList = (parts: Part[]) => {
		return (
			<Stack gap="xs">
				{parts.map((p) => (
					<Box key={p.partId}>
						{(() => {
							const isEditingThisPart = editingPartId === p.partId && isEditablePart(p);
							const hasActiveEdit = Boolean(editingPartId);
							const controlsLockedByOtherEdit = hasActiveEdit && !isEditingThisPart;

							if (!canMutateParts || p.channel === 'main' || controlsLockedByOtherEdit) return null;

							if (isEditingThisPart && onCancelEditPart && onConfirmEditPart) {
								return (
									<Group justify="flex-end" gap={4} mb={4}>
										<IconButtonWithTooltip
											size="xs"
											variant="solid"
											colorPalette="red"
											icon={<LuX />}
											tooltip={t('chat.actions.cancelEdit')}
											aria-label={t('chat.actions.cancelEdit')}
											onClick={onCancelEditPart}
										/>
										<IconButtonWithTooltip
											size="xs"
											variant="solid"
											colorPalette="green"
											icon={<LuCheck />}
											tooltip={t('chat.actions.confirmEdit')}
											aria-label={t('chat.actions.confirmEdit')}
											onClick={onConfirmEditPart}
										/>
									</Group>
								);
							}

							return (
								<Group justify="flex-end" gap={4} mb={4}>
									{onDeletePart && !p.softDeleted && (
										<IconButtonWithTooltip
											size="xs"
											variant="ghost"
											colorPalette="red"
											icon={<LuTrash />}
											tooltip={t('chat.actions.deletePart')}
											aria-label={t('chat.actions.deletePart')}
											onClick={() => onDeletePart(p)}
										/>
									)}
									{onEditPart && isEditablePart(p) && (
										<IconButtonWithTooltip
											size="xs"
											variant="ghost"
											colorPalette="violet"
											icon={<LuPen />}
											tooltip={t('chat.actions.editPart')}
											aria-label={t('chat.actions.editPart')}
											onClick={() => onEditPart(p)}
										/>
									)}
								</Group>
							);
						})()}
						<Box>
							{editingPartId === p.partId && isEditablePart(p) && onDraftTextChange ? (
								<Textarea
									value={draftText}
									onChange={(event) => onDraftTextChange(event.currentTarget.value)}
									autosize
									minRows={estimateInitialEditRows(draftText)}
								/>
							) : (
								renderPart(p, { plainTextForMarkdown: preferPlainText })
							)}
						</Box>
					</Box>
				))}
			</Stack>
		);
	};

	if (!appDebugEnabled) {
		return (
			<Stack gap="xs">
				{hasReasoningContent && (
					<Paper withBorder radius="md" p="sm">
						<Group justify="space-between" align="center">
							<Text size="xs" fw={600}>
								{t('chat.reasoning.title')}
							</Text>
							<Text
								size="xs"
								c="dimmed"
								style={{ cursor: 'pointer', userSelect: 'none' }}
								onClick={() => setReasoningOpen((v) => !v)}
							>
								{reasoningOpen ? t('chat.reasoning.hide') : t('chat.reasoning.show')}
							</Text>
						</Group>
						<Collapse in={reasoningOpen}>
							<Box mt="xs">{renderList(reasoningParts)}</Box>
						</Collapse>
					</Paper>
				)}
				{renderList(mainParts)}
			</Stack>
		);
	}

	return (
		<Stack gap="sm">
			{hasReasoningContent && (
				<Paper withBorder radius="md" p="sm">
					<Group justify="space-between" align="center">
						<Text size="xs" fw={600}>
							{t('chat.reasoning.title')}
						</Text>
						<Text
							size="xs"
							c="dimmed"
							style={{ cursor: 'pointer', userSelect: 'none' }}
							onClick={() => setReasoningOpen((v) => !v)}
						>
							{reasoningOpen ? t('chat.reasoning.hide') : t('chat.reasoning.show')}
						</Text>
					</Group>
					<Collapse in={reasoningOpen}>
						<Box mt="xs">{renderList(reasoningParts)}</Box>
					</Collapse>
				</Paper>
			)}
			{renderList(mainParts)}

			<Group gap="xs" justify="flex-end">
				<Text size="xs" c="dimmed" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setDebugUiEnabled((v) => !v)}>
					{t('chat.debug.debugUi')}: {debugUiEnabled ? t('chat.debug.on') : t('chat.debug.off')}
				</Text>
				<Text size="xs" c="dimmed" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setInspectorOpen((v) => !v)}>
					{t('chat.debug.inspector')}: {inspectorOpen ? t('chat.debug.hide') : t('chat.debug.show')}
				</Text>
			</Group>

			<Collapse in={inspectorOpen}>
				<Paper withBorder radius="md" p="sm">
					<Text size="xs" fw={600} mb="xs">
						{t('chat.debug.rawParts')}
					</Text>
					<Stack gap="xs">
						{allParts.map((p) => (
							<Box key={p.partId}>
								<Text size="xs" c="dimmed">
									{p.channel} order={p.order} id={p.partId} createdTurn={p.createdTurn}{' '}
									{typeof p.replacesPartId === 'string' ? `replaces=${p.replacesPartId}` : ''}
									{p.softDeleted ? ' softDeleted' : ''}
								</Text>
								<Box>{renderPart(p, { plainTextForMarkdown: preferPlainText })}</Box>
							</Box>
						))}
					</Stack>
				</Paper>
			</Collapse>
		</Stack>
	);
};

export const PartsView = memo(PartsViewInner, (prev, next) => {
	return (
		prev.entry === next.entry &&
		prev.variant === next.variant &&
		prev.currentTurn === next.currentTurn &&
		Boolean(prev.preferPlainText) === Boolean(next.preferPlainText) &&
		Boolean(prev.canMutateParts) === Boolean(next.canMutateParts) &&
		prev.editingPartId === next.editingPartId &&
		prev.draftText === next.draftText &&
		prev.onDraftTextChange === next.onDraftTextChange &&
		prev.onCancelEditPart === next.onCancelEditPart &&
		prev.onConfirmEditPart === next.onConfirmEditPart &&
		prev.onEditPart === next.onEditPart &&
		prev.onDeletePart === next.onDeletePart
	);
});
