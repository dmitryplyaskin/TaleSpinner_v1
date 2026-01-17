import { type SamplerItemSettingsType, type SamplersItemType, type SamplersSettingsType } from '@shared/types/samplers';
import { v4 as uuidv4 } from 'uuid';

import { createModel } from '@model/_fabric_';

export const samplersModel = createModel<SamplersSettingsType, SamplersItemType>({
	settings: {
		route: '/settings/samplers',
	},

	items: {
		route: '/samplers',
	},
	fabricName: 'samplers',
});

export const createEmptySampler = (
	value: SamplerItemSettingsType = {} as SamplerItemSettingsType,
): SamplersItemType => ({
	id: uuidv4(),
	name: 'New preset',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	settings: value,
});
