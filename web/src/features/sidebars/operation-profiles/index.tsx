import { Button, Group, Select, Stack, Tabs, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuGitFork, LuRotateCcw, LuSave, LuUndo2 } from 'react-icons/lu';
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
import {
	$operationBlocks,
	createOperationBlockFx,
	deleteOperationBlockFx,
	duplicateOperationBlockRequested,
	exportOperationBlockFx,
	importOperationBlocksFx,
	loadOperationBlocksFx,
} from '@model/operation-blocks';
import { $sidebars } from '@model/sidebars';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

import { OperationBlockEditor, type OperationBlockToolbarState } from './operation-block-editor';
import { OperationProfileBlocksEditor, type OperationProfileBlocksToolbarState } from './operation-profile-blocks-editor';
import { OperationBlockNodeEditorModal } from './node-editor/block-node-editor-modal';
import './operation-profiles.css';
import { BlockActions } from './ui/block-actions';
import { ProfileActions } from './ui/profile-actions';
import { ProfilePicker } from './ui/profile-picker';

const TOOLBAR_TOOLTIP_SETTINGS = TOOLTIP_PORTAL_SETTINGS;

type TabValue = 'profiles' | 'blocks';

export const OperationProfilesSidebar: React.FC = () => {
	const { t } = useTranslation();
	const profiles = useUnit($operationProfiles);
	const settings = useUnit($operationProfileSettings);
	const blocks = useUnit($operationBlocks);
	const sidebars = useUnit($sidebars);

	const loadProfiles = useUnit(loadOperationProfilesFx);
	const loadSettings = useUnit(loadActiveOperationProfileFx);
	const loadBlocks = useUnit(loadOperationBlocksFx);

	const doCreateProfile = useUnit(createOperationProfileFx);
	const doDeleteProfile = useUnit(deleteOperationProfileFx);
	const doSetActiveProfile = useUnit(setActiveOperationProfileRequested);
	const doExportProfile = useUnit(exportOperationProfileFx);
	const doImportProfiles = useUnit(importOperationProfilesFx);
	const doDuplicateProfile = useUnit(duplicateOperationProfileRequested);

	const doCreateBlock = useUnit(createOperationBlockFx);
	const doDeleteBlock = useUnit(deleteOperationBlockFx);
	const doExportBlock = useUnit(exportOperationBlockFx);
	const doImportBlocks = useUnit(importOperationBlocksFx);
	const doDuplicateBlock = useUnit(duplicateOperationBlockRequested);

	const [activeTab, setActiveTab] = React.useState<TabValue>('profiles');
	const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null);
	const [isNodeEditorOpen, setIsNodeEditorOpen] = React.useState(false);
	const [profileToolbarState, setProfileToolbarState] = React.useState<OperationProfileBlocksToolbarState | null>(null);
	const [blockToolbarState, setBlockToolbarState] = React.useState<OperationBlockToolbarState | null>(null);

	React.useEffect(() => {
		void loadProfiles();
		void loadSettings();
		void loadBlocks();
	}, [loadProfiles, loadSettings, loadBlocks]);

	React.useEffect(() => {
		if (blocks.length === 0) {
			setSelectedBlockId(null);
			return;
		}
		if (!selectedBlockId || !blocks.some((b) => b.blockId === selectedBlockId)) {
			setSelectedBlockId(blocks[0]!.blockId);
		}
	}, [blocks, selectedBlockId]);

	const currentProfileId = settings?.activeProfileId ?? null;
	const selectedProfile = profiles.find((p) => p.profileId === currentProfileId) ?? null;
	const selectedBlock = blocks.find((b) => b.blockId === selectedBlockId) ?? null;

	const sidebarState = sidebars.operationProfiles;
	const preferSplitLayout = sidebarState.isFullscreen || sidebarState.size === 'full';
	const uiClassName = preferSplitLayout ? 'op-ui' : 'op-ui op-ui--drawer';

	return (
		<Drawer name="operationProfiles" title={t('operationProfiles.sidebar.title')}>
			<Stack gap="md" className={uiClassName}>
				<Tabs value={activeTab} onChange={(value) => setActiveTab((value as TabValue) ?? 'profiles')}>
					<Tabs.List>
						<Tabs.Tab value="profiles">{t('operationProfiles.tabs.profiles')}</Tabs.Tab>
						<Tabs.Tab value="blocks">{t('operationProfiles.tabs.blocks')}</Tabs.Tab>
					</Tabs.List>
				</Tabs>

				{activeTab === 'profiles' && (
					<>
						<Stack gap="sm" className="op-command">
							<div className="op-commandRow op-commandRowPrimary">
								<ProfilePicker profiles={profiles} value={currentProfileId} onChange={doSetActiveProfile} />
								<ProfileActions
									selected={selectedProfile ? { profileId: selectedProfile.profileId, name: selectedProfile.name } : null}
									onCreate={() =>
										doCreateProfile({
											name: t('operationProfiles.defaults.newProfile'),
											description: undefined,
											enabled: true,
											executionMode: 'concurrent',
											operationProfileSessionId: uuidv4(),
											blockRefs: [],
											meta: undefined,
										})
									}
									onDuplicate={(profileId) => doDuplicateProfile({ sourceProfileId: profileId })}
									onDelete={(profileId) => doDeleteProfile({ profileId })}
									onExport={(profileId) => doExportProfile(profileId)}
									onImport={async (payload) => {
										await doImportProfiles(payload as any);
									}}
								/>
							</div>

							{selectedProfile && profileToolbarState && (
								<div className="op-commandRow op-commandRowSecondary">
									<Group gap="xs" wrap="nowrap" className="op-editorToolbarActions">
										<Button size="sm" leftSection={<LuSave />} disabled={!profileToolbarState.canSave} onClick={profileToolbarState.onSave}>
											{t('common.save')}
										</Button>
										<Button
											size="sm"
											variant="default"
											leftSection={<LuUndo2 />}
											disabled={!profileToolbarState.canDiscard}
											onClick={profileToolbarState.onDiscard}
										>
											{t('operationProfiles.actions.discard')}
										</Button>
										<IconButtonWithTooltip
											aria-label={t('operationProfiles.actions.resetSessionId')}
											tooltip={t('operationProfiles.actions.resetSessionId')}
											icon={<LuRotateCcw />}
											size="input-sm"
											variant="ghost"
											tooltipSettings={TOOLBAR_TOOLTIP_SETTINGS}
											onClick={profileToolbarState.onResetSessionId}
										/>
									</Group>
								</div>
							)}
						</Stack>

						{!selectedProfile ? (
							<Text size="sm" c="dimmed">
								{t('operationProfiles.empty.selectProfile')}
							</Text>
						) : (
							<OperationProfileBlocksEditor profile={selectedProfile} blocks={blocks} onToolbarStateChange={setProfileToolbarState} />
						)}
					</>
				)}

				{activeTab === 'blocks' && (
					<>
						<Stack gap="sm" className="op-command">
							<div className="op-commandRow op-commandRowPrimary">
								<Select
									placeholder={t('operationProfiles.blocks.selectBlock')}
									data={blocks.map((b) => ({ value: b.blockId, label: b.name }))}
									value={selectedBlockId}
									onChange={setSelectedBlockId}
									comboboxProps={{ withinPortal: false }}
									style={{ flex: 1 }}
								/>
								<BlockActions
									selected={selectedBlock ? { blockId: selectedBlock.blockId, name: selectedBlock.name } : null}
									onCreate={async () => {
										const created = await doCreateBlock({
											name: t('operationProfiles.blocks.defaults.newBlock'),
											description: undefined,
											enabled: true,
											operations: [],
											meta: undefined,
										});
										setSelectedBlockId(created.blockId);
									}}
									onDuplicate={(blockId) => doDuplicateBlock({ sourceBlockId: blockId })}
									onDelete={(blockId) => doDeleteBlock({ blockId })}
									onExport={(blockId) => doExportBlock(blockId)}
									onImport={async (payload) => {
										await doImportBlocks(payload as any);
									}}
								/>
							</div>

							<div className="op-commandRow op-commandRowSecondary">
								<Button
									leftSection={<LuGitFork />}
									variant="light"
									className="op-nodeButton"
									disabled={!selectedBlock}
									onClick={() => setIsNodeEditorOpen(true)}
									title={t('operationProfiles.actions.openNodeEditor')}
								>
									{t('operationProfiles.actions.openNodeEditor')}
								</Button>

								{selectedBlock && blockToolbarState && (
									<Group gap="xs" wrap="nowrap" className="op-editorToolbarActions">
										<Button size="sm" leftSection={<LuSave />} disabled={!blockToolbarState.canSave} onClick={blockToolbarState.onSave}>
											{t('common.save')}
										</Button>
										<Button
											size="sm"
											variant="default"
											leftSection={<LuUndo2 />}
											disabled={!blockToolbarState.canDiscard}
											onClick={blockToolbarState.onDiscard}
										>
											{t('operationProfiles.actions.discard')}
										</Button>
									</Group>
								)}
							</div>
						</Stack>

						{!selectedBlock ? (
							<Text size="sm" c="dimmed">
								{t('operationProfiles.blocks.emptySelectBlock')}
							</Text>
						) : (
							<OperationBlockEditor block={selectedBlock} preferSplitLayout={preferSplitLayout} onToolbarStateChange={setBlockToolbarState} />
						)}
					</>
				)}

				{selectedBlock && (
					<OperationBlockNodeEditorModal
						opened={isNodeEditorOpen}
						onClose={() => setIsNodeEditorOpen(false)}
						block={selectedBlock}
					/>
				)}
			</Stack>
		</Drawer>
	);
};
