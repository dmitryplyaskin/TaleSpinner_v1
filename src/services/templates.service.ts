import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import { TemplateSettingsType, TemplateType } from "@shared/types/templates";

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
