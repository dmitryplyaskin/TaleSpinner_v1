import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import { PipelineType, PipelineSettingsType } from "@shared/types/pipelines";

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
    };
  }
}

export const pipelinesService = {
  pipelines: new Pipelines(),
  pipelinesSettings: new PipelinesSettings(),
};
