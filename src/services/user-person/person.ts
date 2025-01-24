import { BaseService } from "@core/services/base-service";
import { UserPerson as UserPersonType } from "@shared/types/user-person";

class UserPerson extends BaseService<UserPersonType> {
  constructor() {
    super("user-person");
  }
}

export default new UserPerson();
