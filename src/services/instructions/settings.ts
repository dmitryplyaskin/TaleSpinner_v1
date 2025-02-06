import { ConfigService } from "@core/services/config-service";
import { InstructionSettingsType } from "@shared/types/instructions";

class InstructionsSettings extends ConfigService<InstructionSettingsType> {
  constructor() {
    super("instructions-settings");
  }

  protected getDefaultConfig(): InstructionSettingsType {
    return {
      selectedId: null,
      enableInstruction: true,
      instructions: [],
    };
  }
}

export default new InstructionsSettings();
