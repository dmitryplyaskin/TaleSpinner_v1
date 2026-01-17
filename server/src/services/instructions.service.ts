import {
  type InstructionType,
  type InstructionSettingsType,
} from "@shared/types/instructions";

import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";

class Instructions extends BaseService<InstructionType> {
  constructor() {
    super("instructions");
  }
}

class InstructionsSettings extends ConfigService<InstructionSettingsType> {
  constructor() {
    super("instructions-settings.json", { logger: console });
  }

  protected getDefaultConfig(): InstructionSettingsType {
    return {
      selectedId: null,
      enabled: true,
    };
  }
}

export const instructionsService = {
  instructions: new Instructions(),
  instructionsSettings: new InstructionsSettings(),
};
