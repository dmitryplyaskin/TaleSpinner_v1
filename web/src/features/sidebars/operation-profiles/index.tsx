import { Button, Select, Stack, Tabs, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuGitFork } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import {
	$operationBlocks,
	createOperationBlockFx,
	deleteOperationBlockFx,
	duplicateOperationBlockRequested,
	loadOperationBlocksFx,
} from '@model/operation-blocks';
import {
	$operationProfileSettings,
	$operationProfiles,
	createOperationProfileFx,
	deleteOperationProfileFx,
	duplicateOperationProfileRequested,
	loadActiveOperationProfileFx,
	loadOperationProfilesFx,
	setActiveOperationProfileRequested,
} from '@model/operation-profiles';
import { $sidebars } from '@model/sidebars';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

import { exportBundle, importBundle } from '../../../api/bundles';
import { resolveBundleAutoApplyTargets } from '../common/bundle-helpers';

import { OperationBlockEditor, type OperationBlockToolbarState } from './operation-block-editor';
import { OperationProfileBlocksEditor, type OperationProfileBlocksToolbarState } from './operation-profile-blocks-editor';
import './operation-profiles.css';
import './operation-workspace.css';
import { BlockActions } from './ui/block-actions';
import { EditorSaveActions } from './ui/editor-save-actions';
import { ProfileActions } from './ui/profile-actions';
import { ProfilePicker } from './ui/profile-picker';
import { RunTracePanel } from './ui/run-trace-panel';

const TOOLBAR_TOOLTIP_SETTINGS = TOOLTIP_PORTAL_SETTINGS;

type TabValue = 'profiles' | 'blocks' | 'run';

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
	const doDuplicateProfile = useUnit(duplicateOperationProfileRequested);

	const doCreateBlock = useUnit(createOperationBlockFx);
	const doDeleteBlock = useUnit(deleteOperationBlockFx);
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

	const handleImportProfiles = async (file: File) => {
		const result = await importBundle(file);
		await loadProfiles();
		await loadBlocks();
		const applyTargets = resolveBundleAutoApplyTargets(result);
		if (applyTargets.operationProfileId) {
			doSetActiveProfile(applyTargets.operationProfileId);
		}
		if (applyTargets.warnings.length > 0) {
			toaster.warning({
				title: t('operationProfiles.toasts.importTitle'),
				description: applyTargets.warnings.join(' '),
			});
		}
		toaster.success({
			title: t('operationProfiles.toasts.importTitle'),
			description: t('operationProfiles.toasts.importedCount', {
				count: result.created.operationProfiles.length,
			}),
		});
	};

	const handleImportBlocks = async (file: File) => {
		const result = await importBundle(file);
		await loadBlocks();
		const firstBlockId = result.created.operationBlocks[0]?.blockId ?? null;
		if (firstBlockId) {
			setSelectedBlockId(firstBlockId);
		}
		if (result.warnings.length > 0) {
			toaster.warning({
				title: t('operationProfiles.toasts.importTitle'),
				description: result.warnings.join(' '),
			});
		}
		toaster.success({
			title: t('operationProfiles.toasts.importTitle'),
			description: t('operationProfiles.toasts.importedCount', {
				count: result.created.operationBlocks.length,
			}),
		});
	};

	const sidebarState = sidebars.operationProfiles;
	const preferSplitLayout = sidebarState.isFullscreen || sidebarState.size === 'full';
	const uiClassName = preferSplitLayout
		? `op-ui op-ui--fullscreen op-ui--${activeTab}`
		: `op-ui op-ui--drawer op-ui--${activeTab}`;

	return (
		<Drawer name="operationProfiles" title={t('operationProfiles.sidebar.title')}>
			<Stack gap="md" className={uiClassName}>
				<Tabs value={activeTab} onChange={(value) => setActiveTab((value as TabValue) ?? 'profiles')}>
					<Tabs.List>
						<Tabs.Tab value="profiles">{t('operationProfiles.tabs.profiles')}</Tabs.Tab>
						<Tabs.Tab value="blocks">{t('operationProfiles.tabs.blocks')}</Tabs.Tab>
						<Tabs.Tab value="run">{t('operationProfiles.tabs.run')}</Tabs.Tab>
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
									onExport={async (profileId) => {
										const exported = await exportBundle({
											source: { kind: 'operation_profile', id: profileId },
											selections: [{ kind: 'operation_profile', id: profileId }],
											format: 'auto',
										});
										return {
											blob: exported.blob,
											filename: exported.filename,
										};
									}}
									onImport={async (file) => {
										await handleImportProfiles(file);
									}}
								/>
							</div>

							{selectedProfile && profileToolbarState && preferSplitLayout && (
								<div className="op-commandRow op-commandRowSecondary">
									<EditorSaveActions state={profileToolbarState} />
								</div>
							)}
						</Stack>
						{!preferSplitLayout && <EditorSaveActions state={profileToolbarState} compact />}

						{!selectedProfile ? (
							<Text size="sm" c="dimmed">
								{t('operationProfiles.empty.selectProfile')}
							</Text>
						) : (
							<OperationProfileBlocksEditor
								profile={selectedProfile}
								blocks={blocks}
								onEditBlock={(blockId) => {
									setSelectedBlockId(blockId);
									setActiveTab('blocks');
								}}
								onToolbarStateChange={setProfileToolbarState}
							/>
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
									onExport={async (blockId) => {
										const exported = await exportBundle({
											source: { kind: 'operation_block', id: blockId },
											selections: [{ kind: 'operation_block', id: blockId }],
											format: 'auto',
										});
										return {
											blob: exported.blob,
											filename: exported.filename,
										};
									}}
									onImport={async (file) => {
										await handleImportBlocks(file);
									}}
								/>
							</div>

							<div className="op-commandRow op-commandRowSecondary">
								{preferSplitLayout ? (
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
								) : (
									<IconButtonWithTooltip
										aria-label={t('operationProfiles.actions.openNodeEditor')}
										tooltip={t('operationProfiles.actions.openNodeEditor')}
										icon={<LuGitFork />}
										size="input-sm"
										variant="ghost"
										tooltipSettings={TOOLBAR_TOOLTIP_SETTINGS}
										disabled={!selectedBlock}
										onClick={() => setIsNodeEditorOpen(true)}
									/>
								)}

								{selectedBlock && blockToolbarState && preferSplitLayout && (
									<EditorSaveActions state={blockToolbarState} />
								)}
							</div>
						</Stack>
						{!preferSplitLayout && <EditorSaveActions state={blockToolbarState} compact />}

						{!selectedBlock ? (
							<Text size="sm" c="dimmed">
								{t('operationProfiles.blocks.emptySelectBlock')}
							</Text>
						) : (
							<OperationBlockEditor
								block={selectedBlock}
								preferSplitLayout={preferSplitLayout}
								nodeEditorOpened={isNodeEditorOpen}
								onNodeEditorClose={() => setIsNodeEditorOpen(false)}
								onToolbarStateChange={setBlockToolbarState}
							/>
						)}
					</>
				)}

				{activeTab === 'run' && <RunTracePanel />}
			</Stack>
		</Drawer>
	);
};
