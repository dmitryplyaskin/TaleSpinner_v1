const fs = require("fs").promises;
const path = require("path");
const { DATA_PATH } = require("../const");

const SETTINGS_FILE = path.join(DATA_PATH, "config", "sampler-settings.json");

class SettingsService {
  async ensureSettingsFile() {
    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      const defaultSettings = {
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
      console.log(defaultSettings);
      return defaultSettings;
    }
  }

  async getSettings() {
    await this.ensureSettingsFile();
    console.log(SETTINGS_FILE);
    const data = await fs.readFile(SETTINGS_FILE, "utf8");
    return JSON.parse(data);
  }

  async saveSettings(settings) {
    await this.ensureSettingsFile();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return settings;
  }
}

module.exports = new SettingsService();
