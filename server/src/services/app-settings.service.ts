import { type AppSettings } from "@shared/types/app-settings";

import { ConfigService } from "@core/services/config-service";

class AppSettingsService extends ConfigService<AppSettings> {
  constructor() {
    super("app-settings.json", { logger: console });
  }

  protected getDefaultConfig(): AppSettings {
    return {
      language: "ru",
      openLastChat: false,
      autoSelectCurrentPersona: false,
    };
  }
}

export default new AppSettingsService();
