import { Group, Select, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuCopyPlus, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import {
	$operationProfileSettings,
	$operationProfiles,
	$selectedOperationProfileId,
	createOperationProfileFx,
	deleteOperationProfileFx,
	exportOperationProfileFx,
	importOperationProfilesFx,
	loadActiveOperationProfileFx,
	loadOperationProfilesFx,
	selectOperationProfileForEdit,
	setActiveOperationProfileRequested,
	duplicateOperationProfileRequested,
} from '@model/operation-profiles';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { OperationProfileEditor } from './operation-profile-editor';

function downloadJson(filename: string, data: unknown) {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export const OperationProfilesSidebar: React.FC = () => {
	const profiles = useUnit($operationProfiles);
	const selectedId = useUnit($selectedOperationProfileId);
	const settings = useUnit($operationProfileSettings);

	const loadProfiles = useUnit(loadOperationProfilesFx);
	const loadSettings = useUnit(loadActiveOperationProfileFx);
	const doSelect = useUnit(selectOperationProfileForEdit);
	const doCreate = useUnit(createOperationProfileFx);
	const doDelete = useUnit(deleteOperationProfileFx);
	const doSetActive = useUnit(setActiveOperationProfileRequested);
	const doExportFx = useUnit(exportOperationProfileFx);
	const doImportFx = useUnit(importOperationProfilesFx);
	const doDuplicate = useUnit(duplicateOperationProfileRequested);

	const fileInputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		void loadProfiles();
		void loadSettings();
	}, []);

	const selected = profiles.find((p) => p.profileId === selectedId) ?? null;

	const profileOptions = [
		{ value: '', label: '(none)' },
		...profiles.map((p) => ({ value: p.profileId, label: `${p.name} (v${p.version})` })),
	];

	return (
		<Drawer name="operationProfiles" title="Operations">
			<Stack gap="md">
				<Stack gap="xs">
					<Text fw={700}>Активный профиль (глобально)</Text>
					<Select
						data={profileOptions}
						value={settings?.activeProfileId ?? ''}
						onChange={(v) => doSetActive(v && v !== '' ? v : null)}
						comboboxProps={{ withinPortal: false }}
					/>
				</Stack>

				<Stack gap="xs">
					<Group justify="space-between" wrap="nowrap" align="flex-end">
						<Select
							label="Редактировать профиль"
							data={profileOptions}
							value={selectedId ?? ''}
							onChange={(v) => doSelect(v && v !== '' ? v : null)}
							comboboxProps={{ withinPortal: false }}
							style={{ flex: 1 }}
						/>

						<Group gap="xs" wrap="nowrap">
							<IconButtonWithTooltip
								aria-label="Create profile"
								tooltip="Создать профиль"
								icon={<LuPlus />}
								onClick={() =>
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
							/>
							<IconButtonWithTooltip
								aria-label="Duplicate profile"
								tooltip="Дублировать профиль"
								icon={<LuCopyPlus />}
								disabled={!selected?.profileId}
								onClick={() => selected?.profileId && doDuplicate({ sourceProfileId: selected.profileId })}
							/>
							<IconButtonWithTooltip
								aria-label="Delete profile"
								tooltip="Удалить профиль"
								icon={<LuTrash2 />}
								colorPalette="red"
								disabled={!selected?.profileId}
								onClick={() => {
									if (!selected?.profileId) return;
									if (!window.confirm('Удалить OperationProfile?')) return;
									doDelete({ profileId: selected.profileId });
								}}
							/>
						</Group>
					</Group>

					<Group gap="xs" justify="flex-end">
						<IconButtonWithTooltip
							aria-label="Export profile"
							tooltip="Экспорт"
							icon={<LuDownload />}
							variant="ghost"
							disabled={!selected?.profileId}
							onClick={async () => {
								if (!selected?.profileId) return;
								try {
									const exported = await doExportFx(selected.profileId);
									downloadJson(`operation-profile-${selected.name}.json`, exported);
								} catch (e) {
									toaster.error({
										title: 'Ошибка экспорта',
										description: e instanceof Error ? e.message : String(e),
									});
								}
							}}
						/>

						<input
							ref={fileInputRef}
							type="file"
							accept="application/json"
							style={{ display: 'none' }}
							onChange={(e) => {
								const file = e.currentTarget.files?.[0];
								if (!file) return;
								const reader = new FileReader();
								reader.onload = async () => {
									try {
										const text = String(reader.result ?? '');
										const parsed = JSON.parse(text) as unknown;
										await doImportFx(parsed as any);
									} catch (err) {
										toaster.error({
											title: 'Ошибка импорта',
											description: err instanceof Error ? err.message : String(err),
										});
									} finally {
										e.currentTarget.value = '';
									}
								};
								reader.readAsText(file);
							}}
						/>

						<IconButtonWithTooltip
							aria-label="Import profiles"
							tooltip="Импорт"
							icon={<LuUpload />}
							variant="ghost"
							onClick={() => {
								fileInputRef.current?.click();
							}}
						/>
					</Group>
				</Stack>

				{!selected ? (
					<Text size="sm" c="dimmed">
						Выберите или создайте профиль, чтобы редактировать операции.
					</Text>
				) : (
					<OperationProfileEditor profile={selected} />
				)}
			</Stack>
		</Drawer>
	);
};

