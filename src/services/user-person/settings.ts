import { ConfigService } from "@core/services/config-service";
import { UserPersonSettings as UserPersonSettingsType } from "@shared/types/user-person";

class UserPersonSettings extends ConfigService<UserPersonSettingsType> {
  constructor() {
    super("user-person-settings");
  }

  getDefaultConfig(): UserPersonSettingsType {
    return {
      selectedUserPersonId: null,
      isUserPersonEnabled: false,
    };
  }
}

export default new UserPersonSettings();
