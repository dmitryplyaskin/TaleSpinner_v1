import { Avatar, Box, Flex, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { $currentEntityProfile } from '@model/chat-core';
import {
	$currentTurn,
	$isChatStreaming,
	$variantsByEntryId,
	loadVariantsRequested,
	manualEditEntryRequested,
	openDeleteEntryConfirm,
	openDeletePartConfirm,
	openDeleteVariantConfirm,
	regenerateRequested,
	selectVariantRequested,
} from '@model/chat-entry-parts';
import { userPersonsModel } from '@model/user-persons';
import { toaster } from '@ui/toaster';

import { BACKEND_ORIGIN } from '../../../api/chat-core';
import { type ChatAvatarPreview } from '../avatar-preview-panel';

import { ActionBar } from './action-bar';
import { AssistantIcon } from './assistant-icon';
import { PartsView } from './parts/parts-view';
import { VariantControls } from './variant-controls';

import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';
import type { Part } from '@shared/types/chat-entry-parts';

type MessageProps = {
	data: ChatEntryWithVariantDto;
	isLast: boolean;
	onAvatarPreviewRequested?: (preview: ChatAvatarPreview) => void;
};

type PersonaSnapshot = {
	id: string;
	name: string;
	avatarUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPersonaSnapshot(meta: unknown): PersonaSnapshot | null {
	if (!isRecord(meta)) return null;
	const snapshot = meta.personaSnapshot;
	if (!isRecord(snapshot)) return null;
	if (typeof snapshot.id !== 'string' || snapshot.id.trim().length === 0) return null;
	if (typeof snapshot.name !== 'string' || snapshot.name.trim().length === 0) return null;

	return {
		id: snapshot.id,
		name: snapshot.name,
		avatarUrl: typeof snapshot.avatarUrl === 'string' && snapshot.avatarUrl.length > 0 ? snapshot.avatarUrl : undefined,
	};
}

function resolveAssetUrl(value?: string | null): string | undefined {
	if (!value) return undefined;
	if (value.startsWith('http://') || value.startsWith('https://')) return value;
	return `${BACKEND_ORIGIN}${value}`;
}

function isEditablePart(part: Part): boolean {
	return (
		!part.softDeleted &&
		typeof part.payload === 'string' &&
		(part.payloadFormat === 'text' || part.payloadFormat === 'markdown')
	);
}

function isEditableMainPart(part: Part): boolean {
	return part.channel === 'main' && isEditablePart(part);
}

const MessageInner: React.FC<MessageProps> = ({ data, isLast, onAvatarPreviewRequested }) => {
	const { t } = useTranslation();
	const [currentProfile, selectedUserPerson] = useUnit([$currentEntityProfile, userPersonsModel.$selectedItem]);
	const isStreaming = useUnit($isChatStreaming);
	const currentTurn = useUnit($currentTurn);
	const variantsById = useUnit($variantsByEntryId);
	const [editingPartId, setEditingPartId] = useState<string | null>(null);
	const [draftText, setDraftText] = useState('');
	const touchStartRef = useRef<{ x: number; y: number } | null>(null);
	const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

	const isUser = data.entry.role === 'user';
	const isAssistant = data.entry.role === 'assistant';
	const assistantName = currentProfile?.name || t('chat.message.assistantFallback');
	const assistantAvatarSrc = resolveAssetUrl(currentProfile?.avatarAssetId ?? undefined);
	const personaSnapshot = useMemo(() => readPersonaSnapshot(data.entry.meta), [data.entry.meta]);
	const userName = personaSnapshot?.name || selectedUserPerson?.name || t('chat.message.you');
	const userAvatarSrc = resolveAssetUrl(personaSnapshot?.avatarUrl ?? selectedUserPerson?.avatarUrl);
	const canPreviewAssistantAvatar = Boolean(assistantAvatarSrc && onAvatarPreviewRequested);
	const canPreviewUserAvatar = Boolean(userAvatarSrc && onAvatarPreviewRequested);
	const tsLabel = useMemo(() => new Date(data.entry.createdAt).toLocaleTimeString(), [data.entry.createdAt]);

	const isOptimistic =
		String(data.entry.entryId).startsWith('local_') || (typeof data.entry.meta === 'object' && Boolean((data.entry.meta as any)?.optimistic));
	const variants = useMemo(() => variantsById[data.entry.entryId] ?? [], [variantsById, data.entry.entryId]);
	const isImportedFirstMessage =
		data.variant?.kind === 'import' &&
		typeof data.entry.meta === 'object' &&
		data.entry.meta !== null &&
		Boolean((data.entry.meta as any)?.imported) &&
		((data.entry.meta as any)?.kind === 'first_mes' || (data.entry.meta as any)?.source === 'entity_profile_import');
	const canSwipeVariants = isAssistant && isLast;

	const editableMainPart = useMemo(() => {
		const parts = data.variant?.parts ?? [];
		const mainCandidates = parts.filter(isEditableMainPart);
		return mainCandidates.length > 0 ? mainCandidates[mainCandidates.length - 1] : null;
	}, [data.variant?.parts]);

	const isEditing = Boolean(editingPartId);
	const canMutateParts = !isOptimistic && !isStreaming;

	useEffect(() => {
		if (!isAssistant) return;
		if (!isLast) return;
		if (variants.length > 0) return;
		loadVariantsRequested({ entryId: data.entry.entryId });
	}, [data.entry.entryId, isAssistant, isLast, variants.length]);

	const currentVariantIndex = useMemo(() => {
		if (variants.length === 0) return -1;
		const idx = variants.findIndex((v) => v.variantId === data.entry.activeVariantId);
		return idx >= 0 ? idx : variants.length - 1;
	}, [data.entry.activeVariantId, variants]);
	const activeVariantIndexInList = useMemo(
		() => variants.findIndex((v) => v.variantId === data.entry.activeVariantId),
		[data.entry.activeVariantId, variants],
	);
	const hasActiveOutsideList =
		variants.length > 0 && activeVariantIndexInList < 0 && Boolean(data.variant && data.variant.variantId === data.entry.activeVariantId);
	const displayVariantCount = hasActiveOutsideList ? variants.length + 1 : variants.length > 0 ? variants.length : data.variant ? 1 : 0;
	const canDeleteVariant = isAssistant && displayVariantCount > 1;

	const swipePrev = () => {
		if (!canSwipeVariants || isEditing || isStreaming || isOptimistic) return;
		if (variants.length === 0 || currentVariantIndex <= 0) return;
		const prev = variants[currentVariantIndex - 1];
		if (!prev) return;
		selectVariantRequested({ entryId: data.entry.entryId, variantId: prev.variantId });
	};

	const swipeNextOrRegenerate = () => {
		if (!canSwipeVariants || isEditing || isStreaming || isOptimistic) return;
		if (variants.length === 0) {
			if (isLast && !isImportedFirstMessage) {
				regenerateRequested({ entryId: data.entry.entryId });
			}
			return;
		}
		if (currentVariantIndex >= 0 && currentVariantIndex < variants.length - 1) {
			const next = variants[currentVariantIndex + 1];
			if (next) selectVariantRequested({ entryId: data.entry.entryId, variantId: next.variantId });
			return;
		}
		if (isLast && !isImportedFirstMessage) {
			regenerateRequested({ entryId: data.entry.entryId });
		}
	};

	const tryApplySwipe = (deltaX: number, deltaY: number) => {
		if (!canSwipeVariants) return;
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);
		if (absX < 48 || absX <= absY) return;
		if (deltaX < 0) {
			swipeNextOrRegenerate();
			return;
		}
		swipePrev();
	};

	const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
		const touch = event.changedTouches[0];
		if (!touch) return;
		touchStartRef.current = { x: touch.clientX, y: touch.clientY };
	};

	const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
		const start = touchStartRef.current;
		touchStartRef.current = null;
		if (!start) return;
		const touch = event.changedTouches[0];
		if (!touch) return;
		tryApplySwipe(touch.clientX - start.x, touch.clientY - start.y);
	};

	const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
		if (event.button !== 0) return;
		pointerStartRef.current = { x: event.clientX, y: event.clientY };
	};

	const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
		if (event.button !== 0) return;
		const start = pointerStartRef.current;
		pointerStartRef.current = null;
		if (!start) return;
		tryApplySwipe(event.clientX - start.x, event.clientY - start.y);
	};

	const handleOpenEdit = () => {
		if (!canMutateParts) return;
		const part = editableMainPart;
		if (!part || typeof part.payload !== 'string') {
			toaster.error({
				title: t('chat.toasts.saveEditError'),
				description: t('chat.errors.editablePartNotFound'),
			});
			return;
		}
		setEditingPartId(part.partId);
		setDraftText(part.payload);
	};

	const handleOpenEditPart = (part: Part) => {
		if (part.channel === 'main') return;
		if (!canMutateParts || !isEditablePart(part)) return;
		if (typeof part.payload !== 'string') return;
		setEditingPartId(part.partId);
		setDraftText(part.payload);
	};

	const handleCancelEdit = () => {
		setEditingPartId(null);
		setDraftText('');
	};

	const handleConfirmEdit = () => {
		if (!editingPartId) return;
		manualEditEntryRequested({ entryId: data.entry.entryId, partId: editingPartId, content: draftText });
		setEditingPartId(null);
		setDraftText('');
	};

	const handleRequestDeleteMessage = () => {
		if (isOptimistic || isStreaming) return;
		openDeleteEntryConfirm({ entryId: data.entry.entryId });
	};

	const handleRequestDeleteVariant = () => {
		if (!canDeleteVariant || isOptimistic || isStreaming) return;
		openDeleteVariantConfirm({ entryId: data.entry.entryId, variantId: data.entry.activeVariantId });
	};

	const handleRequestDeletePart = (part: Part) => {
		if (!canMutateParts || part.softDeleted) return;
		openDeletePartConfirm({ entryId: data.entry.entryId, partId: part.partId });
	};

	const handleAssistantAvatarClick = () => {
		if (!assistantAvatarSrc || !onAvatarPreviewRequested) return;
		onAvatarPreviewRequested({ src: assistantAvatarSrc, name: assistantName, kind: 'assistant' });
	};

	const handleUserAvatarClick = () => {
		if (!userAvatarSrc || !onAvatarPreviewRequested) return;
		onAvatarPreviewRequested({ src: userAvatarSrc, name: userName, kind: 'user' });
	};

	return (
		<Box className="ts-message-grid">
			<Box className="ts-message-avatar ts-message-avatar--assistant">
				{isAssistant ? (
					<AssistantIcon
						size={52}
						name={assistantName}
						src={assistantAvatarSrc}
						onClick={canPreviewAssistantAvatar ? handleAssistantAvatarClick : undefined}
					/>
				) : (
					<Box className="ts-message-avatar-spacer" />
				)}
			</Box>

			<Box style={{ minWidth: 0 }}>
				<Stack gap="xs" style={{ width: '100%' }}>
					<Box
						className="ts-message-card"
						data-role={isUser ? 'user' : 'assistant'}
						onTouchStart={handleTouchStart}
						onTouchEnd={handleTouchEnd}
						onPointerDown={handlePointerDown}
						onPointerUp={handlePointerUp}
					>
						<Flex align="center" justify="space-between" gap="sm">
							<Stack gap={0}>
								<Text size="sm" className="ts-message-name" data-role={isUser ? 'user' : 'assistant'}>
									{isUser ? userName : assistantName}
								</Text>
								<Text size="xs" className="ts-message-meta">
									{tsLabel}
								</Text>
								{isLast && isAssistant && isStreaming && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.streaming')}
									</Text>
								)}
								{isOptimistic && !(isLast && isAssistant && isStreaming) && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.saving')}
									</Text>
								)}
							</Stack>
							<Flex gap="xs" align="center">
								<ActionBar
									isEditing={isEditing}
									canDeleteVariant={canDeleteVariant}
									onOpenEdit={handleOpenEdit}
									onCancelEdit={handleCancelEdit}
									onConfirmEdit={handleConfirmEdit}
									onRequestDeleteMessage={handleRequestDeleteMessage}
									onRequestDeleteVariant={handleRequestDeleteVariant}
								/>
								{isAssistant && <VariantControls entry={data} isLast={isLast} />}
							</Flex>
						</Flex>

						<Box className="ts-message-body ts-chat-serif">
							<PartsView
								entry={data.entry}
								variant={data.variant}
								currentTurn={currentTurn}
								preferPlainText={isAssistant && isLast && isStreaming}
								canMutateParts={canMutateParts}
								editingPartId={editingPartId}
								draftText={draftText}
								onDraftTextChange={setDraftText}
								onEditPart={handleOpenEditPart}
								onDeletePart={handleRequestDeletePart}
							/>
						</Box>
					</Box>
				</Stack>
			</Box>

			<Box className="ts-message-avatar ts-message-avatar--user">
				{isUser ? (
					<Avatar
						size={52}
						name={userName}
						src={userAvatarSrc}
						color="cyan"
						radius="xl"
						onClick={canPreviewUserAvatar ? handleUserAvatarClick : undefined}
						className={canPreviewUserAvatar ? 'ts-message-avatar-clickable' : undefined}
					/>
				) : (
					<Box className="ts-message-avatar-spacer" />
				)}
			</Box>
		</Box>
	);
};

export const Message = memo(MessageInner, (prev, next) => {
	return (
		prev.data === next.data &&
		prev.isLast === next.isLast &&
		prev.onAvatarPreviewRequested === next.onAvatarPreviewRequested
	);
});
