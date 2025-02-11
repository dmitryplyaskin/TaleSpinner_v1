import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import { SamplersItemType, SamplersSettingsType } from "@shared/types/samplers";

class Samplers extends BaseService<SamplersItemType> {
  constructor() {
    super("samplers");
  }
}

class SamplersSettings extends ConfigService<SamplersSettingsType> {
  constructor() {
    super("samplers.json", { logger: console });
  }

  getDefaultConfig(): SamplersSettingsType {
    return {
      selectedId: null,
      enabled: true,
    };
  }
}

export const samplersService = {
  samplers: new Samplers(),
  samplersSettings: new SamplersSettings(),
};
