import { Stack } from '@mantine/core';
import { useUnit } from 'effector-react';

import { $bulkDeleteSelectedEntryIds, $entries, $isBulkDeleteMode, toggleBulkDeleteEntrySelection } from '@model/chat-entry-parts';

import { type ChatAvatarPreview } from './avatar-preview-panel';
import { Message } from './message';

type RenderChatProps = {
	onAvatarPreviewRequested?: (preview: ChatAvatarPreview) => void;
};

export const RenderChat = ({ onAvatarPreviewRequested }: RenderChatProps) => {
	const [entries, isBulkDeleteMode, selectedEntryIds, toggleSelection] = useUnit([
		$entries,
		$isBulkDeleteMode,
		$bulkDeleteSelectedEntryIds,
		toggleBulkDeleteEntrySelection,
	]);
	const selectedSet = new Set(selectedEntryIds);

	if (!entries) return null;

	return (
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
	);
};
