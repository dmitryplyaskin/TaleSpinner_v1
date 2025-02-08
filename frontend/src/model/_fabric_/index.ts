import { createStore, combine, sample } from 'effector';
import { Fabric } from './types';
import { createSettingsModel } from './setting-model';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';
import { createItemsModel } from './items-model';

export const createFabric = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>(
	fabric: Fabric<SettingsType, ItemType>,
) => {
	const $settings = createStore<SettingsType>(fabric.settings.defaultValue || ({} as SettingsType));
	const $items = createStore<ItemType[]>(fabric.items.defaultValue || []);
	const $selectedItem = combine($settings, $items, (settings, items) => {
		if (!settings) return null;
		return items.find((item) => item.id === settings.selectedId);
	});

	const { getSettingsFx, updateSettingsFx } = createSettingsModel(fabric.settings, $settings, fabric.fabricName);
	const { getItemsFx, getItemByIdFx, createItemFx, updateItemFx, deleteItemFx, duplicateItemFx } = createItemsModel(
		fabric.items,
		$items,
		fabric.fabricName,
	);

	sample({
		clock: [createItemFx.doneData, duplicateItemFx.doneData],
		fn: ({ data }) => ({ selectedId: data.id } as Partial<SettingsType>),
		target: updateSettingsFx,
	});

	sample({
		clock: [deleteItemFx.done],
		fn: () => ({ selectedId: null } as Partial<SettingsType>),
		target: updateSettingsFx,
	});

	return {
		$settings,
		$items,
		$selectedItem,

		getSettingsFx,
		updateSettingsFx,

		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
	};
};
