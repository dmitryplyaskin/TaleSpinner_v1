import React from 'react';
import { useTranslation } from 'react-i18next';

import { EntityActionsMenu } from './entity-actions-menu';

type SelectedBlock = { blockId: string; name: string } | null;

type Props = {
	selected: SelectedBlock;
	onCreate: () => void;
	onDuplicate: (blockId: string) => void;
	onDelete: (blockId: string) => void;
	onExport: (blockId: string) => Promise<{ blob: Blob; filename: string }>;
	onImport: (file: File) => Promise<void>;
};

export const BlockActions: React.FC<Props> = ({ selected, onCreate, onDuplicate, onDelete, onExport, onImport }) => {
	const { t } = useTranslation();
	return (
		<EntityActionsMenu
			selected={selected ? { id: selected.blockId, name: selected.name } : null}
			labels={{
				create: t('operationProfiles.blocks.actions.createBlock'),
				more: t('operationProfiles.actions.more'),
				duplicate: t('operationProfiles.blocks.actions.duplicateBlock'),
				remove: t('operationProfiles.blocks.actions.deleteBlock'),
				export: t('operationProfiles.blocks.actions.exportBlock'),
				import: t('operationProfiles.blocks.actions.importBlocks'),
				confirmRemove: t('operationProfiles.confirm.deleteBlock'),
				exportError: t('operationProfiles.toasts.exportError'),
				importError: t('operationProfiles.toasts.importError'),
			}}
			onCreate={onCreate}
			onDuplicate={onDuplicate}
			onRemove={onDelete}
			onExport={onExport}
			onImport={onImport}
		/>
	);
};
