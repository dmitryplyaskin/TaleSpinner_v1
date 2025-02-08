import { ConfigService } from "@core/services/config-service";
import { InstructionSettingsType } from "@shared/types/instructions";

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

export default new InstructionsSettings();
