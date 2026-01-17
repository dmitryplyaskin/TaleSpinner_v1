import { type TemplateSettingsType, type TemplateType } from "@shared/types/templates";

import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";

class Templates extends BaseService<TemplateType> {
  constructor() {
    super("templates");
  }
}

class TemplatesSettings extends ConfigService<TemplateSettingsType> {
  constructor() {
    super("templates-settings.json", { logger: console });
  }

  protected getDefaultConfig(): TemplateSettingsType {
    return {
      selectedId: null,
      enabled: true,
    };
  }
}

export const templatesService = {
  templates: new Templates(),
  templatesSettings: new TemplatesSettings(),
};
