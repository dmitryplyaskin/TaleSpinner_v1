import { ConfigService } from "@core/services/config-service";

import { type SidebarSettings } from "../types";

interface SidebarState {
  settings: SidebarSettings;
  chatCards: SidebarSettings;
  userPersons: SidebarSettings;
  pipeline: SidebarSettings;
  instructions: SidebarSettings;
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
      pipeline: {
        isOpen: false,
        isFullscreen: false,
        placement: "start",
        size: "lg",
        contained: false,
      },
      instructions: {
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
