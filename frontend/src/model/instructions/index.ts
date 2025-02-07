import { createFabric } from '@model/_fabric_';
import { InstructionType, InstructionSettingsType } from '@shared/types/instructions';

export const instructionsModel = createFabric<InstructionSettingsType, InstructionType>({
	settings: {
		route: '/settings/instructions',
	},

	items: {
		route: '/instructions',
	},
	fabricName: 'instructions',
});
