import { Group } from '@mantine/core';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopyPlus, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

type SelectedProfile = { profileId: string; name: string } | null;
const QUICK_ACTION_TOOLTIP_SETTINGS = TOOLTIP_PORTAL_SETTINGS;

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

type Props = {
	selected: SelectedProfile;
	onCreate: () => void;
	onDuplicate: (profileId: string) => void;
	onDelete: (profileId: string) => void;
	onExport: (profileId: string) => Promise<unknown>;
	onImport: (payload: unknown) => Promise<void>;
};

export const ProfileActions: React.FC<Props> = ({ selected, onCreate, onDuplicate, onDelete, onExport, onImport }) => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<Group gap="xs" wrap="nowrap" className="op-profileActions">
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.actions.createProfile')}
				tooltip={t('operationProfiles.actions.createProfile')}
				icon={<LuPlus />}
				size="input-sm"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				onClick={onCreate}
			/>
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.actions.duplicateProfile')}
				tooltip={t('operationProfiles.actions.duplicateProfile')}
				icon={<LuCopyPlus />}
				size="input-sm"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.profileId}
				onClick={() => selected?.profileId && onDuplicate(selected.profileId)}
			/>
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.actions.deleteProfile')}
				tooltip={t('operationProfiles.actions.deleteProfile')}
				icon={<LuTrash2 />}
				size="input-sm"
				colorPalette="red"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.profileId}
				onClick={() => {
					if (!selected?.profileId) return;
					if (!window.confirm(t('operationProfiles.confirm.deleteProfile'))) return;
					onDelete(selected.profileId);
				}}
			/>

			<IconButtonWithTooltip
				aria-label={t('operationProfiles.actions.exportProfile')}
				tooltip={t('operationProfiles.actions.exportProfile')}
				icon={<LuDownload />}
				size="input-sm"
				variant="ghost"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.profileId}
				onClick={async () => {
					if (!selected?.profileId) return;
					try {
						const exported = await onExport(selected.profileId);
						downloadJson(`operation-profile-${selected.name}.json`, exported);
					} catch (e) {
						toaster.error({
							title: t('operationProfiles.toasts.exportError'),
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
							await onImport(parsed);
						} catch (err) {
							toaster.error({
								title: t('operationProfiles.toasts.importError'),
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
				aria-label={t('operationProfiles.actions.importProfiles')}
				tooltip={t('operationProfiles.actions.importProfiles')}
				icon={<LuUpload />}
				size="input-sm"
				variant="ghost"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				onClick={() => {
					fileInputRef.current?.click();
				}}
			/>
		</Group>
	);
};
