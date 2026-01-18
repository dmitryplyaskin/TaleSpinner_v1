import { Group, Select } from '@mantine/core';
import { type CommonModelItemType, type CommonModelSettingsType } from '@shared/types/common-model-types';
import { LuPlus, LuCopy, LuTrash2, LuUpload, LuDownload } from 'react-icons/lu';

import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { useFileOperations } from './use-file-operations';

interface SidebarHeaderProps<SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType> {
	model: {
		$items: any;
		$settings: any;
		createItemFx: (item: ItemType) => void;
		duplicateItemFx: (item: ItemType) => void;
		deleteItemFx: (id: string) => void;
		updateSettingsFx: (settings: Partial<SettingsType>) => void;
	};
	items: ItemType[];
	settings: SettingsType;
	createEmptyItem: () => ItemType;
	name: string;
	labels: {
		createTooltip: string;
		duplicateTooltip: string;
		deleteTooltip: string;
		createAriaLabel: string;
		duplicateAriaLabel: string;
		deleteAriaLabel: string;
	};
}

export const SidebarHeader = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>({
	model,
	items,
	settings,
	createEmptyItem,
	name,
	labels,
}: SidebarHeaderProps<SettingsType, ItemType>) => {
	const options = items.map((item) => ({
		label: item.name,
		value: item.id,
	}));

	const { fileInputRef, handleExport, handleImport, handleFileChange } = useFileOperations({
		model,
		items,
		settings,
		name,
	});

	return (
		<>
			<input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleFileChange} />
			<Group gap="sm" align="flex-end" wrap="nowrap">
				<Select
					data={options}
					value={settings?.selectedId ?? null}
					onChange={(selectedId) => model.updateSettingsFx({ ...settings, selectedId: selectedId ?? null } as Partial<SettingsType>)}
					comboboxProps={{ withinPortal: false }}
					style={{ flex: 1 }}
				/>

				<Group gap="xs" wrap="nowrap">
					<IconButtonWithTooltip
						tooltip={labels.createTooltip}
						icon={<LuPlus />}
						aria-label={labels.createAriaLabel}
						onClick={() => model.createItemFx(createEmptyItem())}
					/>
					<IconButtonWithTooltip
						tooltip={labels.duplicateTooltip}
						icon={<LuCopy />}
						aria-label={labels.duplicateAriaLabel}
						disabled={!settings.selectedId}
						onClick={() => model.duplicateItemFx(items.find((item) => item.id === settings.selectedId) as ItemType)}
					/>
					<IconButtonWithTooltip
						tooltip={labels.deleteTooltip}
						icon={<LuTrash2 />}
						aria-label={labels.deleteAriaLabel}
						disabled={!settings.selectedId}
						onClick={() => model.deleteItemFx(settings.selectedId as string)}
					/>
					<IconButtonWithTooltip tooltip="Импортировать" icon={<LuUpload />} aria-label="Import" onClick={handleImport} />
					<IconButtonWithTooltip
						tooltip="Экспортировать"
						icon={<LuDownload />}
						aria-label="Export"
						disabled={!settings.selectedId}
						onClick={handleExport}
					/>
				</Group>
			</Group>
		</>
	);
};
