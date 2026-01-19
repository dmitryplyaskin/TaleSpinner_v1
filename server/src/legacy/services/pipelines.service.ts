import {
  type PipelineType,
  type PipelineSettingsType,
} from "@shared/types/pipelines";

import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";

class Pipelines extends BaseService<PipelineType> {
  constructor() {
    super("pipelines");
  }
}

class PipelinesSettings extends ConfigService<PipelineSettingsType> {
  constructor() {
    super("pipelines.json", { logger: console });
  }

  getDefaultConfig(): PipelineSettingsType {
    return {
      selectedId: null,
      enabled: true,
      isFullPipelineProcessing: false,
    };
  }
}

export const pipelinesService = {
  pipelines: new Pipelines(),
  pipelinesSettings: new PipelinesSettings(),
};
