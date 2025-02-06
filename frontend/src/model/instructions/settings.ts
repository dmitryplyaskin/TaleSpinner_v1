import { InstructionSettingsType } from '@shared/types/instructions';
import { combine, createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../../api-routes';
import { asyncHandler } from '../utils/async-handler';
import { $instructions } from './instruction';

export const $instructionsSettingsCore = createStore<InstructionSettingsType>({
	selectedId: null,
	enableInstruction: true,
});

export const updateInstructionsSettings = createEvent<InstructionSettingsType>();

export const getInstructionsSettingsFx = createEffect<void, { data: InstructionSettingsType }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.instructions.settings.get());
		return response.json();
	}, 'Error fetching instructions settings'),
);

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

$instructionsSettingsCore
	.on(getInstructionsSettingsFx.doneData, (_, { data }) => data)
	.on(updateInstructionsSettings, (_, settings) => settings);

export const $selectedInstruction = combine($instructionsSettingsCore, $instructions, (settings, instructions) =>
	instructions.find((instruction) => instruction.id === settings.selectedId),
);

sample({
	clock: updateInstructionsSettings,
	target: updateInstructionsSettingsFx,
});
