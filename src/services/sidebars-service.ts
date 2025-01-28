import { ConfigService } from "@core/services/config-service";
import { SidebarSettings } from "../types";

interface SidebarState {
  settings: SidebarSettings;
  chatCards: SidebarSettings;
  userPersons: SidebarSettings;
}

class SidebarsService extends ConfigService<SidebarState> {
  constructor() {
    super("sidebars.json", { logger: console });
  }

  protected getDefaultConfig(): SidebarState {
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

  async getSettings(): Promise<SidebarState> {
    return this.getConfig();
  }

  async saveSettings(settings: SidebarState): Promise<SidebarState> {
    await this.saveConfig(settings);
    return settings;
  }
}

export default new SidebarsService();
