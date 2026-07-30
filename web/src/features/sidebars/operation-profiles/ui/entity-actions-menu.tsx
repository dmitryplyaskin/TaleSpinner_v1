import { ActionIcon, Button, Group, Menu } from '@mantine/core';
import React, { useRef } from 'react';
import { LuCopyPlus, LuEllipsis, LuPlus, LuTrash2 } from 'react-icons/lu';

import { EXPORT_FILE_ICON, IMPORT_FILE_ICON } from '@ui/file-transfer-icons';
import { toaster } from '@ui/toaster';

type Selection = { id: string; name: string } | null;

type Props = {
	selected: Selection;
	labels: {
		create: string;
		more: string;
		duplicate: string;
		remove: string;
		export: string;
		import: string;
		confirmRemove: string;
		exportError: string;
		importError: string;
	};
	onCreate: () => void;
	onDuplicate: (id: string) => void;
	onRemove: (id: string) => void;
	onExport: (id: string) => Promise<{ blob: Blob; filename: string }>;
	onImport: (file: File) => Promise<void>;
};

function downloadJson(filename: string, blob: Blob) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export const EntityActionsMenu: React.FC<Props> = ({
	selected,
	labels,
	onCreate,
	onDuplicate,
	onRemove,
	onExport,
	onImport,
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<Group gap="xs" wrap="nowrap" className="op-profileActions">
			<Button size="sm" leftSection={<LuPlus />} onClick={onCreate}>
				{labels.create}
			</Button>
			<Menu position="bottom-end" withinPortal={false} shadow="md">
				<Menu.Target>
					<ActionIcon size="input-sm" variant="default" aria-label={labels.more} title={labels.more}>
						<LuEllipsis />
					</ActionIcon>
				</Menu.Target>
				<Menu.Dropdown>
					<Menu.Item
						leftSection={<LuCopyPlus size={15} />}
						disabled={!selected}
						onClick={() => selected && onDuplicate(selected.id)}
					>
						{labels.duplicate}
					</Menu.Item>
					<Menu.Item
						leftSection={<EXPORT_FILE_ICON size={15} />}
						disabled={!selected}
						onClick={() => {
							if (!selected) return;
							void onExport(selected.id)
								.then((result) => downloadJson(result.filename, result.blob))
								.catch((error) =>
									toaster.error({ title: labels.exportError, description: error instanceof Error ? error.message : String(error) }),
								);
						}}
					>
						{labels.export}
					</Menu.Item>
					<Menu.Item leftSection={<IMPORT_FILE_ICON size={15} />} onClick={() => fileInputRef.current?.click()}>
						{labels.import}
					</Menu.Item>
					<Menu.Divider />
					<Menu.Item
						color="red"
						leftSection={<LuTrash2 size={15} />}
						disabled={!selected}
						onClick={() => {
							if (!selected || !window.confirm(labels.confirmRemove)) return;
							onRemove(selected.id);
						}}
					>
						{labels.remove}
					</Menu.Item>
				</Menu.Dropdown>
			</Menu>

			<input
				ref={fileInputRef}
				type="file"
				accept="application/json"
				style={{ display: 'none' }}
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					if (!file) return;
					void onImport(file)
						.catch((error) =>
							toaster.error({ title: labels.importError, description: error instanceof Error ? error.message : String(error) }),
						)
						.finally(() => {
							event.currentTarget.value = '';
						});
				}}
			/>
		</Group>
	);
};
