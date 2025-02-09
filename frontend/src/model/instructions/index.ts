import { createModel } from '@model/_fabric_';
import { InstructionType, InstructionSettingsType } from '@shared/types/instructions';
import { v4 as uuidv4 } from 'uuid';
export const instructionsModel = createModel<InstructionSettingsType, InstructionType>({
	settings: {
		route: '/settings/instructions',
	},
	items: {
		route: '/instructions',
	},
	fabricName: 'instructions',
});

export const createEmptyInstruction = (): InstructionType => ({
	id: uuidv4(),
	name: 'Новая инструкция',
	instruction: '',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});
