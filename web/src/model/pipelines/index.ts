import { type CommonModelItemType } from '@shared/types/common-model-types';
import { type PipelineSettingsType } from '@shared/types/pipelines';
import { v4 as uuidv4 } from 'uuid';

import { createModel } from '@model/_fabric_';

export type PipelineDbType = CommonModelItemType & {
	ownerId?: string;
	enabled: boolean;
	definition: unknown;
};

export const pipelinesModel = createModel<PipelineSettingsType, PipelineDbType>({
	settings: {
		route: '/settings/pipelines',
	},

	items: {
		route: '/pipelines',
	},
	fabricName: 'pipelines',
});

export const createEmptyPipeline = (): PipelineDbType => ({
	id: uuidv4(),
	name: 'New pipeline',
	enabled: true,
	definition: {},
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});
