import { ConfigService } from "@core/services/config-service";
import { InstructionSettingsType } from "@shared/types/instructions";

type InstructionSettings = Omit<InstructionSettingsType, "instructions">;
class InstructionsSettings extends ConfigService<InstructionSettings> {
  constructor() {
    super("instructions-settings.json", { logger: console });
  }

  protected getDefaultConfig(): InstructionSettings {
    return {
      selectedId: null,
      enableInstruction: true,
    };
  }
}

export default new InstructionsSettings();
