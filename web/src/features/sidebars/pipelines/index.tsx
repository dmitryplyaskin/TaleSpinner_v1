import { Button, Divider, Flex, Group, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { type PipelineSettingsType } from '@shared/types/pipelines';
import { useUnit } from 'effector-react';
import React from 'react';

import { $currentBranchId, $currentChat } from '@model/chat-core';
import { createEmptyPipeline, pipelinesModel } from '@model/pipelines';
import {
	$chatActivePipelineProfile,
	$pipelineDebug,
	$pipelineProfiles,
	$pipelineRuntime,
	loadChatActivePipelineProfileFx,
	loadPipelineProfilesFx,
	refreshPipelineDebugRequested,
	setChatActiveProfileRequested,
	setEntityActiveProfileRequested,
	setGlobalActiveProfileRequested,
} from '@model/pipeline-runtime';
import { Drawer } from '@ui/drawer';

import { SidebarHeader } from '../common/sidebar-header';

import { PipelineForm } from './pipeline-form';

export const PipelineSidebar: React.FC = () => {
	const pipelines = useUnit(pipelinesModel.$items);
	const settings = useUnit(pipelinesModel.$settings);
	const currentChat = useUnit($currentChat);
	const currentBranchId = useUnit($currentBranchId);

	const pipelineProfiles = useUnit($pipelineProfiles);
	const activeProfile = useUnit($chatActivePipelineProfile);
	const runtime = useUnit($pipelineRuntime);
	const debug = useUnit($pipelineDebug);

	const loadProfiles = useUnit(loadPipelineProfilesFx);
	const loadActiveProfile = useUnit(loadChatActivePipelineProfileFx);
	const refreshDebug = useUnit(refreshPipelineDebugRequested);
	const setChatProfile = useUnit(setChatActiveProfileRequested);
	const setEntityProfile = useUnit(setEntityActiveProfileRequested);
	const setGlobalProfile = useUnit(setGlobalActiveProfileRequested);

	const handleSettingsChange = (newSettings: Partial<PipelineSettingsType>) => {
		pipelinesModel.updateSettingsFx({ ...settings, ...newSettings });
	};

	React.useEffect(() => {
		void loadProfiles();
		if (currentChat?.id) {
			void loadActiveProfile({ chatId: currentChat.id });
			void refreshDebug({ chatId: currentChat.id, branchId: currentBranchId ?? undefined });
		}
	}, [currentChat?.id]);

	const profileOptions = [
		{ value: '', label: '(inherit / none)' },
		...pipelineProfiles.map((p) => ({ value: p.id, label: `${p.name} (v${p.version})` })),
	];

	const resolvedLabel = activeProfile?.resolved?.profile
		? `${activeProfile.resolved.profile.name} (v${activeProfile.resolved.profile.version})`
		: '(none)';

	const snapshotText = (() => {
		const snap = (debug as any)?.generation?.promptSnapshot;
		if (!snap) return '';
		try {
			return JSON.stringify(snap, null, 2);
		} catch {
			return String(snap);
		}
	})();

	return (
		<Drawer name="pipeline" title="Pipeline">
			<Stack gap="md">
				<SidebarHeader
					model={pipelinesModel}
					items={pipelines}
					settings={settings}
					name="pipeline"
					createEmptyItem={createEmptyPipeline}
					labels={{
						createTooltip: 'Создать инструкцию',
						duplicateTooltip: 'Дублировать инструкцию',
						deleteTooltip: 'Удалить инструкцию',
						createAriaLabel: 'Create instruction',
						duplicateAriaLabel: 'Duplicate instruction',
						deleteAriaLabel: 'Delete instruction',
					}}
				/>
				<Flex gap="md" wrap="wrap">
					<Switch
						checked={settings.enabled}
						onChange={(e) => handleSettingsChange({ enabled: e.currentTarget.checked })}
						color="green"
						label="Enable pipelines"
						description="Enable pipelines to use them in chat"
					/>
					<Switch
						checked={settings.isFullPipelineProcessing}
						onChange={(e) => handleSettingsChange({ isFullPipelineProcessing: e.currentTarget.checked })}
						label="Full pipeline processing"
						description="Completely replaces response generation and is entirely based on pipelines."
					/>
				</Flex>

				<Divider />

				<Stack gap="xs">
					<Text fw={700}>Active PipelineProfile</Text>
					<Text size="sm" c="dimmed">
						Resolved: {resolvedLabel} (source: {activeProfile?.resolved?.source ?? '—'})
					</Text>

					<Select
						label="Chat override"
						disabled={!currentChat?.id}
						data={profileOptions}
						value={activeProfile?.bindings?.chat?.profileId ?? ''}
						onChange={(v) => {
							if (!currentChat?.id) return;
							setChatProfile({ chatId: currentChat.id, profileId: v && v !== '' ? v : null });
						}}
						comboboxProps={{ withinPortal: false }}
					/>

					<Select
						label="EntityProfile override"
						disabled={!activeProfile?.entityProfileId}
						data={profileOptions}
						value={activeProfile?.bindings?.entityProfile?.profileId ?? ''}
						onChange={(v) => {
							if (!activeProfile?.entityProfileId) return;
							setEntityProfile({ entityProfileId: activeProfile.entityProfileId, profileId: v && v !== '' ? v : null });
						}}
						comboboxProps={{ withinPortal: false }}
					/>

					<Select
						label="Global default"
						data={profileOptions}
						value={activeProfile?.bindings?.global?.profileId ?? ''}
						onChange={(v) => setGlobalProfile({ profileId: v && v !== '' ? v : null })}
						comboboxProps={{ withinPortal: false }}
					/>
				</Stack>

				<Divider />

				<Stack gap="xs">
					<Group justify="space-between" wrap="nowrap">
						<Text fw={700}>Pipeline Debug</Text>
						<Button
							size="xs"
							variant="light"
							disabled={!currentChat?.id}
							onClick={() => currentChat?.id && refreshDebug({ chatId: currentChat.id, branchId: currentBranchId ?? undefined })}
						>
							Refresh
						</Button>
					</Group>

					<Text size="sm" c="dimmed">
						Last runtime: {runtime.status ?? '—'} {runtime.runId ? `(runId=${runtime.runId})` : ''}
					</Text>

					<Text size="sm" c="dimmed">
						Debug: runId={(debug as any)?.run?.id ?? '—'} genId={(debug as any)?.generation?.id ?? '—'} promptHash=
						{(debug as any)?.generation?.promptHash ?? '—'}
					</Text>

					<Textarea
						label="promptSnapshot (redacted)"
						value={snapshotText}
						readOnly
						minRows={10}
						autosize
						styles={{ input: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' } }}
					/>
				</Stack>

				<Divider />

				<PipelineForm />
			</Stack>
		</Drawer>
	);
};
