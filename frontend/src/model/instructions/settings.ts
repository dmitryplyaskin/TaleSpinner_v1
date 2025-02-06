import { InstructionSettingsType } from '@shared/types/instructions';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../../api-routes';
import { asyncHandler } from '../utils/async-handler';

export const $instructionsSettings = createStore<InstructionSettingsType>({
	selectedId: null,
	enableInstruction: true,
	instructions: [],
});

export const updateInstructionsSettings = createEvent<InstructionSettingsType>();

$instructionsSettings.on(updateInstructionsSettings, (_, settings) => settings);

export const getInstructionsSettingsFx = createEffect<void, { data: InstructionSettingsType }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.instructions.settings.get());
		return response.json();
	}, 'Error fetching instructions settings'),
);

$instructionsSettings.on(getInstructionsSettingsFx.doneData, (_, { data }) => data);

export const updateInstructionsSettingsFx = createEffect<InstructionSettingsType, void>((settings) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.instructions.settings.update(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(settings),
		});
	}, 'Error updating instructions settings'),
);

sample({
	clock: updateInstructionsSettings,
	target: updateInstructionsSettingsFx,
});
