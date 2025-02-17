import { createModel } from '@model/_fabric_';
import { PipelineItemType, PipelineSettingsType, PipelineType } from '@shared/types/pipelines';
import { v4 as uuidv4 } from 'uuid';

export const pipelinesModel = createModel<PipelineSettingsType, PipelineType>({
	settings: {
		route: '/settings/pipelines',
	},

	items: {
		route: '/pipelines',
	},
	fabricName: 'pipelines',
});

export const createEmptyPipeline = (): PipelineType => ({
	id: uuidv4(),
	name: 'New pipeline',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	pipelines: [],
});
