import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { userPersonsService } from "@services/user-persons.service";

const userPersonsController = new GeneralController(
  userPersonsService.userPersons,
  userPersonsService.userPersonsSettings
);

const userPersonsRoutes = new RouteFactory(
  { general: userPersonsController },
  "user-persons"
);

export default userPersonsRoutes.getRouter();
