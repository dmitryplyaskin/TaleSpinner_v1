import { type AppSettings } from "@shared/types/app-settings";

import {
  getAppSettings,
  updateAppSettings,
} from "./app-settings/app-settings-repository";

class AppSettingsService {
  async getConfig(): Promise<AppSettings> {
    return getAppSettings();
  }

  async updateConfig(updates: Partial<AppSettings>): Promise<AppSettings> {
    return updateAppSettings(updates);
  }
}

export default new AppSettingsService();
