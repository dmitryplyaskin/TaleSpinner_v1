import { Button, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuGitFork } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import {
	$operationProfileSettings,
	$operationProfiles,
	createOperationProfileFx,
	deleteOperationProfileFx,
	exportOperationProfileFx,
	importOperationProfilesFx,
	loadActiveOperationProfileFx,
	loadOperationProfilesFx,
	setActiveOperationProfileRequested,
	duplicateOperationProfileRequested,
} from '@model/operation-profiles';
import { Drawer } from '@ui/drawer';

import { OperationProfileEditor } from './operation-profile-editor';
import { OperationProfileNodeEditorModal } from './node-editor/node-editor-modal';
import { ProfileActions } from './ui/profile-actions';
import { ProfilePicker } from './ui/profile-picker';

export const OperationProfilesSidebar: React.FC = () => {
	const profiles = useUnit($operationProfiles);
	const settings = useUnit($operationProfileSettings);

	const loadProfiles = useUnit(loadOperationProfilesFx);
	const loadSettings = useUnit(loadActiveOperationProfileFx);
	const doCreate = useUnit(createOperationProfileFx);
	const doDelete = useUnit(deleteOperationProfileFx);
	const doSetActive = useUnit(setActiveOperationProfileRequested);
	const doExportFx = useUnit(exportOperationProfileFx);
	const doImportFx = useUnit(importOperationProfilesFx);
	const doDuplicate = useUnit(duplicateOperationProfileRequested);

	const [isNodeEditorOpen, setIsNodeEditorOpen] = React.useState(false);

	React.useEffect(() => {
		void loadProfiles();
		void loadSettings();
	}, []);

	const currentProfileId = settings?.activeProfileId ?? null;
	const selected = profiles.find((p) => p.profileId === currentProfileId) ?? null;

	return (
		<Drawer name="operationProfiles" title="Operations">
			<Stack gap="md">
				<ProfilePicker profiles={profiles} value={currentProfileId} onChange={doSetActive} />

				<ProfileActions
					selected={selected ? { profileId: selected.profileId, name: selected.name } : null}
					onCreate={() =>
						doCreate({
							name: 'New profile',
							description: undefined,
							enabled: true,
							executionMode: 'concurrent',
							operationProfileSessionId: uuidv4(),
							operations: [],
							meta: undefined,
						})
					}
					onDuplicate={(profileId) => doDuplicate({ sourceProfileId: profileId })}
					onDelete={(profileId) => doDelete({ profileId })}
					onExport={(profileId) => doExportFx(profileId)}
					onImport={async (payload) => {
						await doImportFx(payload as any);
					}}
				/>

				{!selected ? (
					<Text size="sm" c="dimmed">
						Выберите профиль (Current profile), чтобы редактировать операции.
					</Text>
				) : (
					<Stack gap="md">
						<Button
							leftSection={<LuGitFork />}
							variant="light"
							onClick={() => setIsNodeEditorOpen(true)}
							title="Открыть нодовый редактор (полный экран)"
						>
							Открыть нодовый редактор
						</Button>

						<OperationProfileEditor profile={selected} />

						<OperationProfileNodeEditorModal
							opened={isNodeEditorOpen}
							onClose={() => setIsNodeEditorOpen(false)}
							profile={selected}
						/>
					</Stack>
				)}
			</Stack>
		</Drawer>
	);
};

