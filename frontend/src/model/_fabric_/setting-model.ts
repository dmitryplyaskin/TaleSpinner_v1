import { attach, createEffect, StoreWritable } from 'effector';
import { FabricSettings } from './types';
import { asyncHandler } from '@model/utils/async-handler';
import { CommonModelSettingsType } from '@shared/types/common-model-types';
import { BASE_URL } from '../../const';

export const createSettingsModel = <SettingsType extends CommonModelSettingsType>(
	fabricParams: FabricSettings<SettingsType>,
	$store: StoreWritable<SettingsType>,
	fabricName: string,
) => {
	const getSettingsFx = createEffect<void, { data: SettingsType }>(() =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${fabricParams.route}`);
			return response.json();
		}, `Error fetching ${fabricName} settings`),
	);

	const updateSettingsFx = createEffect<Partial<SettingsType>, void>((settings) =>
		asyncHandler(async () => {
			if (!settings) throw new Error(`Settings are not found for ${fabricName}`);
			console.log(settings);
			const response = await fetch(`${BASE_URL}${fabricParams.route}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(settings),
			});

			return response.json();
		}, `Error updating ${fabricName} settings`),
	);

	// @ts-ignore
	const attachUpdateSettingsFx = attach<Partial<SettingsType>, SettingsType>({
		effect: updateSettingsFx,
		source: $store,
		mapParams(params, states) {
			return { ...states, ...params };
		},
	});

	$store
		.on(getSettingsFx.doneData, (_, { data }) => data)

		.on(updateSettingsFx.done, (state, { params }) => ({ ...state, ...params }));

	return {
		getSettingsFx,
		updateSettingsFx: attachUpdateSettingsFx,
	};
};
