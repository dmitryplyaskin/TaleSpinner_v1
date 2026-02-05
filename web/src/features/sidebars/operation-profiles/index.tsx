import { Button, Group, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuGitFork } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import {
	$operationProfileSettings,
	$operationProfiles,
	createOperationProfileFx,
	deleteOperationProfileFx,
	duplicateOperationProfileRequested,
	exportOperationProfileFx,
	importOperationProfilesFx,
	loadActiveOperationProfileFx,
	loadOperationProfilesFx,
	setActiveOperationProfileRequested
} from '@model/operation-profiles';
import { $sidebars } from '@model/sidebars';
import { Drawer } from '@ui/drawer';

import { OperationProfileNodeEditorModal } from './node-editor/node-editor-modal';
import { OperationProfileEditor } from './operation-profile-editor';
import './operation-profiles.css';
import { ProfileActions } from './ui/profile-actions';
import { ProfilePicker } from './ui/profile-picker';

export const OperationProfilesSidebar: React.FC = () => {
	const profiles = useUnit($operationProfiles);
	const settings = useUnit($operationProfileSettings);
	const sidebars = useUnit($sidebars);

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
	}, [loadProfiles, loadSettings]);

	const currentProfileId = settings?.activeProfileId ?? null;
	const selected = profiles.find((p) => p.profileId === currentProfileId) ?? null;
	const sidebarState = sidebars.operationProfiles;
	const preferSplitLayout = sidebarState.isFullscreen || sidebarState.size === 'full';

	return (
		<Drawer name="operationProfiles" title="Operations">
			<Stack gap="md" className="op-ui">
				<Stack gap="sm" className="op-command">
					<Group justify="space-between" align="flex-end" wrap="wrap">
						<ProfilePicker profiles={profiles} value={currentProfileId} onChange={doSetActive} />
						<Button
							leftSection={<LuGitFork />}
							variant="light"
							className="op-nodeButton"
							disabled={!selected}
							onClick={() => setIsNodeEditorOpen(true)}
							title="Open full-screen node editor"
						>
							Open Node Editor
						</Button>
					</Group>

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
				</Stack>

				{!selected ? (
					<Text size="sm" c="dimmed">
						Select a profile to edit operations.
					</Text>
				) : (
					<OperationProfileEditor profile={selected} preferSplitLayout={preferSplitLayout} />
				)}

				{selected && (
					<OperationProfileNodeEditorModal
						opened={isNodeEditorOpen}
						onClose={() => setIsNodeEditorOpen(false)}
						profile={selected}
					/>
				)}
			</Stack>
		</Drawer>
	);
};
