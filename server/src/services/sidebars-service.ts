import { type SidebarState } from "../types";

import { getSidebarsState, saveSidebarsState } from "./sidebars/sidebars-repository";

class SidebarsService {
  async getSettings(): Promise<SidebarState> {
    return getSidebarsState();
  }

  async saveSettings(settings: SidebarState): Promise<SidebarState> {
    return saveSidebarsState(settings);
  }
}

export default new SidebarsService();
