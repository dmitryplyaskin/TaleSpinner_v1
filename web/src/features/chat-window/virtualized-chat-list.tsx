import { Box, Loader, Stack } from '@mantine/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useUnit } from 'effector-react';
import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';

import {
	$bulkDeleteSelectedEntryIds,
	$entries,
	$entriesPageInfo,
	$isBulkDeleteMode,
	toggleBulkDeleteEntrySelection,
} from '@model/chat-entry-parts';

import { type ChatAvatarPreview } from './avatar-preview-panel';
import { Message } from './message';

const VIRTUALIZATION_THRESHOLD = 40;
const ROW_ESTIMATED_HEIGHT = 220;
const ROW_OVERSCAN = 10;

type VirtualizedChatListProps = {
	scrollElement: HTMLDivElement | null;
	scrollToBottomSignal: number;
	onAvatarPreviewRequested?: (preview: ChatAvatarPreview) => void;
};

type VirtualMeasuredRowProps = {
	index: number;
	start: number;
	width: string;
	measure: (element: HTMLElement | null | undefined) => void;
	children: ReactNode;
};

const VirtualMeasuredRow = ({ index, start, width, measure, children }: VirtualMeasuredRowProps) => {
	const rowRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const node = rowRef.current;
		if (!node) return;
		measure(node);
		const observer = new ResizeObserver(() => measure(node));
		observer.observe(node);
		return () => observer.disconnect();
	}, [measure, index]);

	return (
		<div
			ref={rowRef}
			data-index={index}
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width,
				transform: `translateY(${start}px)`,
				paddingBottom: 8,
			}}
		>
			{children}
		</div>
	);
};

export const VirtualizedChatList = ({
	scrollElement,
	scrollToBottomSignal,
	onAvatarPreviewRequested,
}: VirtualizedChatListProps) => {
	const [entries, isBulkDeleteMode, selectedEntryIds, toggleSelection, pageInfo] = useUnit([
		$entries,
		$isBulkDeleteMode,
		$bulkDeleteSelectedEntryIds,
		toggleBulkDeleteEntrySelection,
		$entriesPageInfo,
	]);
	const selectedSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
	const shouldVirtualize = entries.length >= VIRTUALIZATION_THRESHOLD;
	const entriesCountRef = useRef(entries.length);
	entriesCountRef.current = entries.length;

	const virtualizer = useVirtualizer({
		count: shouldVirtualize ? entries.length : 0,
		getScrollElement: () => scrollElement,
		estimateSize: () => ROW_ESTIMATED_HEIGHT,
		overscan: ROW_OVERSCAN,
		getItemKey: (index) => entries[index]?.entry.entryId ?? `row_${index}`,
	});

	useLayoutEffect(() => {
		if (!scrollElement) return;
		const entryCount = entriesCountRef.current;
		if (entryCount === 0) return;
		if (shouldVirtualize) {
			virtualizer.scrollToIndex(entryCount - 1, { align: 'end' });
			return;
		}
		scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'auto' });
	}, [scrollElement, scrollToBottomSignal, shouldVirtualize]);

	if (!entries.length) return null;

	return (
		<Box style={{ position: 'relative' }}>
			{pageInfo.isLoadingOlder && (
				<Box
					className="ts-chat-loading-older-overlay"
					style={{
						position: 'absolute',
						top: 6,
						left: 0,
						right: 0,
						display: 'flex',
						justifyContent: 'center',
						pointerEvents: 'none',
						zIndex: 3,
					}}
				>
					<Loader size="xs" />
				</Box>
			)}

			{shouldVirtualize ? (
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						position: 'relative',
					}}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const entry = entries[virtualRow.index];
						if (!entry) return null;
						return (
							<VirtualMeasuredRow
								key={entry.entry.entryId}
								index={virtualRow.index}
								start={virtualRow.start}
								width="100%"
								measure={virtualizer.measureElement}
							>
								<Message
									data={entry}
									isLast={virtualRow.index === entries.length - 1}
									onAvatarPreviewRequested={onAvatarPreviewRequested}
									isBulkDeleteMode={isBulkDeleteMode}
									isBulkSelected={selectedSet.has(entry.entry.entryId)}
									onToggleBulkSelection={toggleSelection}
								/>
							</VirtualMeasuredRow>
						);
					})}
				</div>
			) : (
				<Stack gap="md">
					{entries.map((entry, index) => (
						<Message
							key={entry.entry.entryId}
							data={entry}
							isLast={index === entries.length - 1}
							onAvatarPreviewRequested={onAvatarPreviewRequested}
							isBulkDeleteMode={isBulkDeleteMode}
							isBulkSelected={selectedSet.has(entry.entry.entryId)}
							onToggleBulkSelection={toggleSelection}
						/>
					))}
				</Stack>
			)}
		</Box>
	);
};

export default memo(VirtualizedChatList);
