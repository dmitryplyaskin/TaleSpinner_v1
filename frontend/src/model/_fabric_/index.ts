import { createStore, combine } from 'effector';
import { Fabric } from './types';
import { createSettingsModel } from './setting-model';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';

export const createFabric = <SettingsType extends CommonModelSettingsType, ItemType extends CommonModelItemType>(
	fabric: Fabric<SettingsType, ItemType>,
) => {
	const $settings = createStore<SettingsType | null>(fabric.settings.defaultValue || null);
	const $items = createStore<ItemType[]>(fabric.items.defaultValue || []);
	const $selectedItem = combine($settings, $items, (settings, items) => {
		if (!settings) return null;
		return items.find((item) => item.id === settings.selectedId);
	});

	const { getSettings, updateSettings } = createSettingsModel(fabric.settings, $settings, fabric.fabricName);

	return { $settings, $items, $selectedItem };
};
