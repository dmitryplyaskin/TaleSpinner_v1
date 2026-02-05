import { Group, Text } from '@mantine/core';
import React, { useRef } from 'react';
import { LuCopyPlus, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

type SelectedProfile = { profileId: string; name: string } | null;

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
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<Group justify="space-between" wrap="wrap" align="flex-end" gap="xs">
			<Text className="op-commandTitle">Quick actions</Text>
			<Group gap="xs" wrap="nowrap">
				<IconButtonWithTooltip aria-label="Create profile" tooltip="Create profile" icon={<LuPlus />} onClick={onCreate} />
				<IconButtonWithTooltip
					aria-label="Duplicate profile"
					tooltip="Duplicate profile"
					icon={<LuCopyPlus />}
					disabled={!selected?.profileId}
					onClick={() => selected?.profileId && onDuplicate(selected.profileId)}
				/>
				<IconButtonWithTooltip
					aria-label="Delete profile"
					tooltip="Delete profile"
					icon={<LuTrash2 />}
					colorPalette="red"
					disabled={!selected?.profileId}
					onClick={() => {
						if (!selected?.profileId) return;
						if (!window.confirm('Delete this operation profile?')) return;
						onDelete(selected.profileId);
					}}
				/>

				<IconButtonWithTooltip
					aria-label="Export profile"
					tooltip="Export profile"
					icon={<LuDownload />}
					variant="ghost"
					disabled={!selected?.profileId}
					onClick={async () => {
						if (!selected?.profileId) return;
						try {
							const exported = await onExport(selected.profileId);
							downloadJson(`operation-profile-${selected.name}.json`, exported);
						} catch (e) {
							toaster.error({
								title: 'Export failed',
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
									title: 'Import failed',
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
					tooltip="Import profiles"
					icon={<LuUpload />}
					variant="ghost"
					onClick={() => {
						fileInputRef.current?.click();
					}}
				/>
			</Group>
		</Group>
	);
};
