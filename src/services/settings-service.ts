import fs from "fs/promises";
import path from "path";
import { DATA_PATH } from "../const";
import { Settings } from "../types";

const SETTINGS_FILE = path.join(DATA_PATH, "config", "sampler-settings.json");

class SettingsService {
  async ensureSettingsFile(): Promise<Settings> {
    try {
      await fs.access(SETTINGS_FILE);
      return {} as Settings;
    } catch {
      const defaultSettings: Settings = {
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      };
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(
        SETTINGS_FILE,
        JSON.stringify(defaultSettings, null, 2)
      );
      return defaultSettings;
    }
  }

  async getSettings(): Promise<Settings> {
    await this.ensureSettingsFile();
    const data = await fs.readFile(SETTINGS_FILE, "utf8");
    return JSON.parse(data);
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    await this.ensureSettingsFile();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return settings;
  }
}

export default new SettingsService();
