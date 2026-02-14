import { Group } from '@mantine/core';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopyPlus, LuDownload, LuPlus, LuTrash2, LuUpload } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

type SelectedBlock = { blockId: string; name: string } | null;
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
	selected: SelectedBlock;
	onCreate: () => void;
	onDuplicate: (blockId: string) => void;
	onDelete: (blockId: string) => void;
	onExport: (blockId: string) => Promise<unknown>;
	onImport: (payload: unknown) => Promise<void>;
};

export const BlockActions: React.FC<Props> = ({ selected, onCreate, onDuplicate, onDelete, onExport, onImport }) => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<Group gap="xs" wrap="nowrap" className="op-profileActions">
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.blocks.actions.createBlock')}
				tooltip={t('operationProfiles.blocks.actions.createBlock')}
				icon={<LuPlus />}
				size="input-sm"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				onClick={onCreate}
			/>
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.blocks.actions.duplicateBlock')}
				tooltip={t('operationProfiles.blocks.actions.duplicateBlock')}
				icon={<LuCopyPlus />}
				size="input-sm"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.blockId}
				onClick={() => selected?.blockId && onDuplicate(selected.blockId)}
			/>
			<IconButtonWithTooltip
				aria-label={t('operationProfiles.blocks.actions.deleteBlock')}
				tooltip={t('operationProfiles.blocks.actions.deleteBlock')}
				icon={<LuTrash2 />}
				size="input-sm"
				colorPalette="red"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.blockId}
				onClick={() => {
					if (!selected?.blockId) return;
					if (!window.confirm(t('operationProfiles.confirm.deleteBlock'))) return;
					onDelete(selected.blockId);
				}}
			/>

			<IconButtonWithTooltip
				aria-label={t('operationProfiles.blocks.actions.exportBlock')}
				tooltip={t('operationProfiles.blocks.actions.exportBlock')}
				icon={<LuDownload />}
				size="input-sm"
				variant="ghost"
				tooltipSettings={QUICK_ACTION_TOOLTIP_SETTINGS}
				disabled={!selected?.blockId}
				onClick={async () => {
					if (!selected?.blockId) return;
					try {
						const exported = await onExport(selected.blockId);
						downloadJson(`operation-block-${selected.name}.json`, exported);
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
				aria-label={t('operationProfiles.blocks.actions.importBlocks')}
				tooltip={t('operationProfiles.blocks.actions.importBlocks')}
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
