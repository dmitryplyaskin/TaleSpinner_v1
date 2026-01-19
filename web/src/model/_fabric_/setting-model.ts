import { type CommonModelSettingsType } from '@shared/types/common-model-types';
import { attach, createEffect, createStore } from 'effector';

import { asyncHandler } from '@model/utils/async-handler';

import { BASE_URL } from '../../const';

import { type FabricSettings } from './types';

async function safeReadJson(response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : {};
	} catch {
		// Most common case: 404 HTML page or proxy error.
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
}

export const createSettingsModel = <SettingsType extends CommonModelSettingsType>(
	fabricParams: FabricSettings<SettingsType>,
	fabricName: string,
) => {
	const $settings = createStore<SettingsType>(fabricParams.defaultValue || ({} as SettingsType));

	const getSettingsFx = createEffect<void, { data: SettingsType }>(() =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${fabricParams.route}`);
			const json = (await safeReadJson(response)) as { data: SettingsType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
		}, `Error fetching ${fabricName} settings`),
	);

	const updateSettingsFx = createEffect<Partial<SettingsType>, void>((settings) =>
		asyncHandler(async () => {
			if (!settings) throw new Error(`Settings are not found for ${fabricName}`);
			const response = await fetch(`${BASE_URL}${fabricParams.route}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(settings),
			});

			const json = (await safeReadJson(response)) as { data: SettingsType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return;
		}, `Error updating ${fabricName} settings`),
	);

	// @ts-expect-error -- attach typing here is tricky; we merge partial params into current settings
	const attachUpdateSettingsFx = attach<Partial<SettingsType>, SettingsType>({
		effect: updateSettingsFx,
		source: $settings,
		mapParams(params, states) {
			return { ...states, ...params };
		},
	});

	$settings
		.on(getSettingsFx.doneData, (_, { data }) => data)
		.on(updateSettingsFx.done, (state, { params }) => ({ ...state, ...params }));

	return {
		$settings,
		getSettingsFx,
		updateSettingsFx: attachUpdateSettingsFx,
	};
};
