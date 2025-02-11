import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import {
  UserPersonType as UserPersonType,
  UserPersonSettingsType as UserPersonSettingsType,
} from "@shared/types/user-person";

class UserPersons extends BaseService<UserPersonType> {
  constructor() {
    super("user-persons");
  }
}

class UserPersonsSettings extends ConfigService<UserPersonSettingsType> {
  constructor() {
    super("user-persons.json", { logger: console });
  }

  getDefaultConfig(): UserPersonSettingsType {
    return {
      selectedId: null,
      enabled: false,
    };
  }
}

export const userPersonsService = {
  userPersons: new UserPersons(),
  userPersonsSettings: new UserPersonsSettings(),
};
