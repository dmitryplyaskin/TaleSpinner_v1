import { ConfigService } from "@core/services/config-service";

import { type PipelineSettingsType } from "@shared/types/pipelines";

class PipelinesSettingsService extends ConfigService<PipelineSettingsType> {
  constructor() {
    super("pipelines-settings.json", { logger: console });
  }

  protected getDefaultConfig(): PipelineSettingsType {
    return {
      selectedId: null,
      enabled: true,
      isFullPipelineProcessing: false,
    };
  }
}

export const pipelinesSettingsService = new PipelinesSettingsService();

