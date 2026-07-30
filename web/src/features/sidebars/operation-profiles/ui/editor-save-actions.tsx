import { Button, Group, Text } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FloppyDiskIcon, ArrowUUpLeftIcon } from '@ui/icons';

export type EditorSaveState = {
	canSave: boolean;
	canDiscard: boolean;
	onSave: () => void;
	onDiscard: () => void;
};

type Props = {
	state: EditorSaveState | null;
	compact?: boolean;
};

export const EditorSaveActions: React.FC<Props> = ({ state, compact = false }) => {
	const { t } = useTranslation();
	if (!state || (compact && !state.canSave)) return null;

	return (
		<div className={compact ? 'op-compactSaveBar' : 'op-editorToolbarActions'}>
			{compact && (
				<Text size="sm" fw={600} className="op-saveStatus">
					{t('operationProfiles.operationEditor.unsaved')}
				</Text>
			)}
			<Group gap="xs" wrap="nowrap">
				<Button
					size="sm"
					variant="default"
					leftSection={<ArrowUUpLeftIcon />}
					disabled={!state.canDiscard}
					onClick={state.onDiscard}
				>
					{t('operationProfiles.actions.discard')}
				</Button>
				<Button size="sm" leftSection={<FloppyDiskIcon />} disabled={!state.canSave} onClick={state.onSave}>
					{t('common.save')}
				</Button>
			</Group>
		</div>
	);
};
