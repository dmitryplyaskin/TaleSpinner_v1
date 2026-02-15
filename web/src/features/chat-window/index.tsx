import { Box, Button, Group, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { $currentChat } from '@model/chat-core';
import {
	$bulkDeleteSelectedEntryIds,
	$chatViewportState,
	$entries,
	$entriesPageInfo,
	$isBulkDeleteMode,
	chatViewportChanged,
	exitBulkDeleteMode,
	incrementUnseenMessages,
	loadOlderPageRequested,
	openBulkDeleteConfirm,
	resetUnseenMessages,
} from '@model/chat-entry-parts';

import BGImages from '../../assets/bg.png';

import { AvatarPreviewPanel, type ChatAvatarPreview } from './avatar-preview-panel';
import { MessageInput } from './input';
import { MessageActionModals } from './message/message-action-modals';
import { VirtualizedChatList } from './virtualized-chat-list';

const LOAD_OLDER_TRIGGER_PX = 4;

export const ChatWindow: React.FC = () => {
	const { t } = useTranslation();
	const chat = useUnit($currentChat);
	const entries = useUnit($entries);
	const [isBulkDeleteMode, selectedEntryIds, closeBulkDeleteMode, requestBulkDeleteConfirm] = useUnit([
		$isBulkDeleteMode,
		$bulkDeleteSelectedEntryIds,
		exitBulkDeleteMode,
		openBulkDeleteConfirm,
	]);
	const [pageInfo, viewportState, onViewportChanged, requestOlderPage, addUnseenMessages, clearUnseenMessages] = useUnit([
		$entriesPageInfo,
		$chatViewportState,
		chatViewportChanged,
		loadOlderPageRequested,
		incrementUnseenMessages,
		resetUnseenMessages,
	]);
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
	const [scrollToBottomSignal, setScrollToBottomSignal] = useState(0);
	const prevEntriesCountRef = useRef(0);
	const prevScrollTopRef = useRef<number | null>(null);
	const olderLoadPendingRef = useRef(false);
	const lastOlderLoadRequestedAtRef = useRef(0);
	const prependAnchorRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<ChatAvatarPreview | null>(null);

	useEffect(() => {
		prevEntriesCountRef.current = 0;
		setAvatarPreview(null);
		clearUnseenMessages();
		setScrollToBottomSignal((prev) => prev + 1);
	}, [chat?.id, clearUnseenMessages]);

	useEffect(() => {
		if (!chat) return;
		const prevCount = prevEntriesCountRef.current;
		const nextCount = entries.length;
		const isPrependingOlder = Boolean(prependAnchorRef.current) || pageInfo.isLoadingOlder;
		if (nextCount > prevCount && !viewportState.isAtBottom && !isPrependingOlder) {
			addUnseenMessages({ count: nextCount - prevCount });
		}
		prevEntriesCountRef.current = nextCount;
		if (viewportState.isAtBottom) {
			setScrollToBottomSignal((prev) => prev + 1);
		}
	}, [addUnseenMessages, chat, entries, pageInfo.isLoadingOlder, viewportState.isAtBottom]);

	useEffect(() => {
		const node = scrollElement;
		if (!node) return;
		const anchor = prependAnchorRef.current;
		if (pageInfo.isLoadingOlder) return;

		if (anchor) {
			const delta = node.scrollHeight - anchor.scrollHeight;
			node.scrollTop = Math.max(0, anchor.scrollTop + delta);
			prependAnchorRef.current = null;
			onViewportChanged({
				distanceToBottom: Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop),
			});
		}
	}, [entries.length, onViewportChanged, pageInfo.isLoadingOlder, scrollElement]);

	useEffect(() => {
		if (!pageInfo.isLoadingOlder) {
			olderLoadPendingRef.current = false;
		}
	}, [pageInfo.isLoadingOlder]);

	const requestOlderWithGuard = useCallback(() => {
		if (!scrollElement) return;
		if (!pageInfo.hasMoreOlder || !pageInfo.nextCursor || pageInfo.isLoadingOlder) return;
		if (olderLoadPendingRef.current) return;

		const now = Date.now();
		if (now - lastOlderLoadRequestedAtRef.current < 260) return;
		lastOlderLoadRequestedAtRef.current = now;
		olderLoadPendingRef.current = true;

		prependAnchorRef.current = {
			scrollTop: scrollElement.scrollTop,
			scrollHeight: scrollElement.scrollHeight,
		};
		requestOlderPage();
	}, [pageInfo.hasMoreOlder, pageInfo.isLoadingOlder, pageInfo.nextCursor, requestOlderPage, scrollElement]);

	const handleScroll = useCallback(() => {
		if (!scrollElement) return;
		const currentTop = scrollElement.scrollTop;
		const distanceToBottom = Math.max(
			0,
			scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop,
		);
		onViewportChanged({ distanceToBottom });
		const prevTop = prevScrollTopRef.current;
		prevScrollTopRef.current = currentTop;
		if (prevTop === null) return;
		// Edge-trigger: load only when user reaches absolute top, not when simply near top.
		if (prevTop > LOAD_OLDER_TRIGGER_PX && currentTop <= LOAD_OLDER_TRIGGER_PX) {
			requestOlderWithGuard();
		}
	}, [onViewportChanged, requestOlderWithGuard, scrollElement]);

	const handleWheel: React.WheelEventHandler<HTMLDivElement> = useCallback(
		(event) => {
			if (!scrollElement) return;
			if (event.deltaY >= 0) return;
			if (scrollElement.scrollTop > LOAD_OLDER_TRIGGER_PX) return;
			requestOlderWithGuard();
		},
		[requestOlderWithGuard, scrollElement],
	);

	const jumpToLatest = useCallback(() => {
		clearUnseenMessages();
		setScrollToBottomSignal((prev) => prev + 1);
	}, [clearUnseenMessages]);

	return (
		<Box className="ts-chat-window" style={{ backgroundImage: `url(${BGImages})` }}>
			<Box className="ts-chat-window__inner" data-preview-open={avatarPreview ? 'true' : 'false'}>
				<Box className="ts-chat-scroll" ref={setScrollElement} onScroll={handleScroll} onWheel={handleWheel}>
					<Box className="ts-chat-content">
						<VirtualizedChatList
							scrollElement={scrollElement}
							scrollToBottomSignal={scrollToBottomSignal}
							onAvatarPreviewRequested={setAvatarPreview}
						/>

						<Box className="ts-chat-composer-wrap">
							{!viewportState.isAtBottom && viewportState.unseenCount > 0 && (
								<Box className="ts-chat-unseen-wrap">
									<Button size="xs" variant="light" color="cyan" onClick={jumpToLatest}>
										{t('chat.unseenMessagesCta', {
											count: viewportState.unseenCount,
											defaultValue: `${viewportState.unseenCount} new messages`,
										})}
									</Button>
								</Box>
							)}
							{isBulkDeleteMode && (
								<Box className="ts-bulk-delete-toolbar">
									<Group justify="space-between" align="center">
										<Text size="sm">{t('chat.management.bulkSelectedCount', { count: selectedEntryIds.length })}</Text>
										<Group gap="xs">
											<Button
												size="xs"
												color="red"
												onClick={() => requestBulkDeleteConfirm()}
												disabled={selectedEntryIds.length === 0}
											>
												{t('common.delete')}
											</Button>
											<Button size="xs" variant="subtle" onClick={() => closeBulkDeleteMode()}>
												{t('common.cancel')}
											</Button>
										</Group>
									</Group>
								</Box>
							)}
							<MessageInput />
						</Box>
					</Box>
				</Box>

				<AvatarPreviewPanel preview={avatarPreview} onClose={() => setAvatarPreview(null)} />
			</Box>
			<MessageActionModals />
		</Box>
	);
};
