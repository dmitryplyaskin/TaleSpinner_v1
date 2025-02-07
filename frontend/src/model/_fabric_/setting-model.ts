import { createEffect, StoreWritable } from 'effector';
import { FabricSettings } from './types';
import { asyncHandler } from '@model/utils/async-handler';
import { CommonModelSettingsType } from '@shared/types/common-model-types';

export const createSettingsModel = <SettingsType extends CommonModelSettingsType>(
	fabricParams: FabricSettings<SettingsType>,
	$store: StoreWritable<SettingsType>,
	fabricName: string,
) => {
	const getSettingsFx = createEffect<void, { data: SettingsType }>(() =>
		asyncHandler(async () => {
			const response = await fetch(fabricParams.route);
			return response.json();
		}, `Error fetching ${fabricName} settings`),
	);

	const updateSettingsFx = createEffect<Partial<SettingsType>, void>((settings) =>
		asyncHandler(async () => {
			if (!settings) throw new Error(`Settings are not found for ${fabricName}`);
			const response = await fetch(fabricParams.route, {
				method: 'PUT',

				body: JSON.stringify(settings),
			});
			return response.json();
		}, `Error updating ${fabricName} settings`),
	);

	$store
		.on(getSettingsFx.doneData, (_, { data }) => data)
		.on(updateSettingsFx.done, (state, { params }) => ({ ...state, ...params }));

	return {
		getSettingsFx,
		updateSettingsFx,
	};
};
