import { type InstructionType, type InstructionSettingsType } from '@shared/types/instructions';
import { v4 as uuidv4 } from 'uuid';

import { createModel } from '@model/_fabric_';
import i18n from '../../i18n';

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
	name: i18n.t('instructions.defaults.newInstruction'),
	instruction: '',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});
