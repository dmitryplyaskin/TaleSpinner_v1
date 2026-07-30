import { Group, Select, Stack, Text } from '@mantine/core';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { CopyIcon, PencilSimpleIcon, PlusIcon, FloppyDiskIcon, TrashIcon } from '@ui/icons';


import type { ReactNode } from 'react';

type PresetOption = {
	value: string;
	label: string;
};

type PresetControlsLabels = {
	title: string;
	active: string;
	create: string;
	rename: string;
	duplicate: string;
	save: string;
	delete: string;
};

type PresetControlsLayout = 'inline' | 'stacked';

type Props = {
	labels: PresetControlsLabels;
	options: PresetOption[];
	value: string | null;
	onChange: (value: string | null) => void;
	onCreate: () => void;
	onRename: () => void;
	onDuplicate: () => void;
	onSave: () => void;
	onDelete: () => void;
	disableRename?: boolean;
	disableDuplicate?: boolean;
	disableSave?: boolean;
	disableDelete?: boolean;
	layout?: PresetControlsLayout;
	extraActions?: ReactNode;
	showSaveAction?: boolean;
};

export const PresetControls: React.FC<Props> = ({
	labels,
	options,
	value,
	onChange,
	onCreate,
	onRename,
	onDuplicate,
	onSave,
	onDelete,
	disableRename = false,
	disableDuplicate = false,
	disableSave = false,
	disableDelete = false,
	layout = 'inline',
	extraActions,
	showSaveAction = true,
}) => {
	const actionButtons = (
		<>
			<IconButtonWithTooltip icon={<PlusIcon />} tooltip={labels.create} aria-label={labels.create} onClick={onCreate} />
			<IconButtonWithTooltip
				icon={<PencilSimpleIcon />}
				tooltip={labels.rename}
				aria-label={labels.rename}
				onClick={onRename}
				disabled={disableRename}
			/>
			<IconButtonWithTooltip
				icon={<CopyIcon />}
				tooltip={labels.duplicate}
				aria-label={labels.duplicate}
				onClick={onDuplicate}
				disabled={disableDuplicate}
			/>
			{extraActions}
			{showSaveAction ? (
				<IconButtonWithTooltip
					icon={<FloppyDiskIcon />}
					tooltip={labels.save}
					aria-label={labels.save}
					onClick={onSave}
					disabled={disableSave}
					variant="solid"
				/>
			) : null}
			<IconButtonWithTooltip
				icon={<TrashIcon />}
				tooltip={labels.delete}
				aria-label={labels.delete}
				onClick={onDelete}
				disabled={disableDelete}
			/>
		</>
	);

	return (
		<Stack gap="xs">
			<Text fw={600}>{labels.title}</Text>
			{layout === 'stacked' ? (
				<>
					<Select
						label={labels.active}
						data={options}
						value={value}
						onChange={(nextValue) => onChange(nextValue ?? null)}
						allowDeselect={false}
						comboboxProps={{ withinPortal: false }}
					/>
					<Group gap="xs" justify="flex-end">
						{actionButtons}
					</Group>
				</>
			) : (
				<Group align="flex-end">
					<Select
						style={{ flex: 1 }}
						label={labels.active}
						data={options}
						value={value}
						onChange={(nextValue) => onChange(nextValue ?? null)}
						allowDeselect={false}
						comboboxProps={{ withinPortal: false }}
					/>
					<Group gap="xs" pb={4}>
						{actionButtons}
					</Group>
				</Group>
			)}
		</Stack>
	);
};
