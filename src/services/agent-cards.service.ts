import { ConfigService } from "@core/services/config-service";
import { Chat } from "../types";
import { BaseService } from "@core/services/base-service";
import { AgentCardSettingsType } from "@shared/types/agent-card";

class ChatService extends BaseService<Chat> {
  constructor() {
    super("agent-cards", { logger: console });
  }
}

class ChatSettings extends ConfigService<AgentCardSettingsType> {
  constructor() {
    super("agent-cards.json", { logger: console });
  }

  getDefaultConfig(): AgentCardSettingsType {
    return {
      selectedId: null,
      enabled: true,
    };
  }
}

export const chatService = {
  service: new ChatService(),
  settings: new ChatSettings(),
};
