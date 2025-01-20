const fs = require("fs");
const path = require("path");
const { createDataPath } = require("../utils");
const fileService = require("./file-service");

const CONFIG_FILE = "sidebars.json";

class SidebarsService {
  constructor() {
    this.configPath = createDataPath("config");
    this.filePath = path.join(this.configPath, CONFIG_FILE);
    this.ensureConfigDirectory();
  }

  ensureConfigDirectory() {
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }
  }

  async getSettings() {
    try {
      if (!fs.existsSync(this.filePath)) {
        // Return default settings if file doesn't exist
        return {
          settings: {
            isOpen: false,
            isFullscreen: false,
            placement: "start",
            size: "lg",
            contained: false,
          },
          chatCards: {
            isOpen: false,
            isFullscreen: false,
            placement: "start",
            size: "lg",
            contained: false,
          },
          userPersons: {
            isOpen: false,
            isFullscreen: false,
            placement: "start",
            size: "lg",
            contained: false,
          },
        };
      }

      return await fileService.readJson(this.filePath);
    } catch (error) {
      console.error("Ошибка при чтении настроек сайдбаров:", error);
      throw error;
    }
  }

  async saveSettings(settings) {
    try {
      await fileService.saveFile(this.filePath, JSON.stringify(settings, null, 2));
      return settings;
    } catch (error) {
      console.error("Ошибка при сохранении настроек сайдбаров:", error);
      throw error;
    }
  }
}

module.exports = new SidebarsService();
