import React from 'react';
import { useTranslation } from 'react-i18next';

import { EntityActionsMenu } from './entity-actions-menu';

type SelectedProfile = { profileId: string; name: string } | null;

type Props = {
	selected: SelectedProfile;
	onCreate: () => void;
	onDuplicate: (profileId: string) => void;
	onDelete: (profileId: string) => void;
	onExport: (profileId: string) => Promise<{ blob: Blob; filename: string }>;
	onImport: (file: File) => Promise<void>;
};

export const ProfileActions: React.FC<Props> = ({ selected, onCreate, onDuplicate, onDelete, onExport, onImport }) => {
	const { t } = useTranslation();
	return (
		<EntityActionsMenu
			selected={selected ? { id: selected.profileId, name: selected.name } : null}
			labels={{
				create: t('operationProfiles.actions.createProfile'),
				more: t('operationProfiles.actions.more'),
				duplicate: t('operationProfiles.actions.duplicateProfile'),
				remove: t('operationProfiles.actions.deleteProfile'),
				export: t('operationProfiles.actions.exportProfile'),
				import: t('operationProfiles.actions.importProfiles'),
				confirmRemove: t('operationProfiles.confirm.deleteProfile'),
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
