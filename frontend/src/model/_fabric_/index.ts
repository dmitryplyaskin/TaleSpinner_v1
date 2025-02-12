import { combine, sample } from 'effector';
import { Fabric } from './types';
import { createSettingsModel } from './setting-model';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';
import { createItemsModel } from './items-model';

export const createModel = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>(
	fabric: Fabric<SettingsType, ItemType>,
) => {
	const { getSettingsFx, updateSettingsFx, $settings } = createSettingsModel(fabric.settings, fabric.fabricName);
	const {
		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
		$items,
		changeItemDebounced,
		changeItem,
	} = createItemsModel(fabric.items, fabric.fabricName);

	const $selectedItem = combine($settings, $items, (settings, items) => {
		if (!settings) return null;
		return items.find((item) => item.id === settings.selectedId) || null;
	});

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
		changeItemDebounced,
		changeItem,
	};
};
