import fs from "fs";
import path from "path";
import { createDataPath } from "../utils";
import fileService from "./file-service";

const CONFIG_FILE = "sidebars.json";

interface SidebarSettings {
  isOpen: boolean;
  isFullscreen: boolean;
  placement: string;
  size: string;
  contained: boolean;
}

interface SidebarState {
  settings: SidebarSettings;
  chatCards: SidebarSettings;
  userPersons: SidebarSettings;
}

class SidebarsService {
  private configPath: string;
  private filePath: string;

  constructor() {
    this.configPath = createDataPath("config");
    this.filePath = path.join(this.configPath, CONFIG_FILE);
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }
  }

  async getSettings(): Promise<SidebarState> {
    try {
      if (!fs.existsSync(this.filePath)) {
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

      return await fileService.readJson<SidebarState>(this.filePath);
    } catch (error) {
      console.error("Ошибка при чтении настроек сайдбаров:", error);
      throw error;
    }
  }

  async saveSettings(settings: SidebarState): Promise<SidebarState> {
    try {
      await fileService.saveFile(
        this.filePath,
        JSON.stringify(settings, null, 2)
      );
      return settings;
    } catch (error) {
      console.error("Ошибка при сохранении настроек сайдбаров:", error);
      throw error;
    }
  }
}

export default new SidebarsService();
