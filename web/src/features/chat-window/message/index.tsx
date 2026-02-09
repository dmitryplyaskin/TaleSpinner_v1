import { Avatar, Box, Flex, Stack, Text, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { $currentEntityProfile } from '@model/chat-core';
import {
	$currentTurn,
	$isChatStreaming,
	$variantsByEntryId,
	loadVariantsRequested,
	manualEditEntryRequested,
	regenerateRequested,
	selectVariantRequested,
	softDeleteEntryRequested,
} from '@model/chat-entry-parts';
import { toaster } from '@ui/toaster';

import { ActionBar } from './action-bar';
import { AssistantIcon } from './assistant-icon';
import { PartsView } from './parts/parts-view';
import { VariantControls } from './variant-controls';

import type { ChatEntryWithVariantDto } from '../../../api/chat-entry-parts';

type MessageProps = {
	data: ChatEntryWithVariantDto;
	isLast: boolean;
};

export const Message: React.FC<MessageProps> = ({ data, isLast }) => {
	const { t } = useTranslation();
	const currentProfile = useUnit($currentEntityProfile);
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

	const editableMainPart = useMemo(() => {
		const parts = data.variant?.parts ?? [];
		const candidates = parts.filter(
			(part) =>
				!part.softDeleted &&
				part.channel === 'main' &&
				typeof part.payload === 'string' &&
				(part.payloadFormat === 'text' || part.payloadFormat === 'markdown'),
		);
		return candidates.length > 0 ? candidates[candidates.length - 1] : null;
	}, [data.variant?.parts]);

	const isEditing = Boolean(editingPartId);

	useEffect(() => {
		if (!isAssistant) return;
		if (!isLast && !isImportedFirstMessage) return;
		if (variants.length > 0) return;
		loadVariantsRequested({ entryId: data.entry.entryId });
	}, [data.entry.entryId, isAssistant, isImportedFirstMessage, isLast, variants.length]);

	const currentVariantIndex = useMemo(() => {
		if (variants.length === 0) return -1;
		const idx = variants.findIndex((v) => v.variantId === data.entry.activeVariantId);
		return idx >= 0 ? idx : variants.length - 1;
	}, [data.entry.activeVariantId, variants]);

	const swipePrev = () => {
		if (!isAssistant || isEditing || isStreaming || isOptimistic) return;
		if (variants.length === 0 || currentVariantIndex <= 0) return;
		const prev = variants[currentVariantIndex - 1];
		if (!prev) return;
		selectVariantRequested({ entryId: data.entry.entryId, variantId: prev.variantId });
	};

	const swipeNextOrRegenerate = () => {
		if (!isAssistant || isEditing || isStreaming || isOptimistic) return;
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
		if (isOptimistic || isStreaming) return;
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

	const handleDelete = () => {
		if (isOptimistic || isStreaming) return;
		softDeleteEntryRequested({ entryId: data.entry.entryId });
	};

	return (
		<Box className="ts-message-grid">
			<Box className="ts-message-avatar ts-message-avatar--assistant">
				{isAssistant ? <AssistantIcon size={52} /> : <Box className="ts-message-avatar-spacer" />}
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
									{isUser ? t('chat.message.you') : assistantName}
								</Text>
								<Text size="xs" className="ts-message-meta">
									{tsLabel}
								</Text>
								{isLast && isAssistant && isStreaming && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.streaming')}
									</Text>
								)}
								{isOptimistic && (
									<Text size="xs" className="ts-message-meta">
										{t('chat.message.saving')}
									</Text>
								)}
							</Stack>
							<Flex gap="xs" align="center">
								{isAssistant && <VariantControls entry={data} isLast={isLast} />}
								<ActionBar
									isEditing={isEditing}
									onOpenEdit={handleOpenEdit}
									onCancelEdit={handleCancelEdit}
									onConfirmEdit={handleConfirmEdit}
									onDelete={handleDelete}
									placement="inline"
								/>
							</Flex>
						</Flex>

						<Box className="ts-message-body ts-chat-serif">
							{isEditing ? (
								<Textarea
									value={draftText}
									onChange={(event) => setDraftText(event.currentTarget.value)}
									autosize
									minRows={2}
									maxRows={12}
								/>
							) : (
								<PartsView entry={data.entry} variant={data.variant} currentTurn={currentTurn} />
							)}
						</Box>
					</Box>
				</Stack>
			</Box>

			<Box className="ts-message-avatar ts-message-avatar--user">
				{isUser ? <Avatar size={52} name="User" src="/user-avatar.png" color="cyan" radius="xl" /> : <Box className="ts-message-avatar-spacer" />}
			</Box>
		</Box>
	);
};
