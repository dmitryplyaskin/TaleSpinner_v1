import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { instructionsService } from "@services/instructions.service";

const instructionsController = new GeneralController(
  instructionsService.instructions,
  instructionsService.instructionsSettings
);

const instructionsRoutes = new RouteFactory(
  { general: instructionsController },
  "instructions"
);

export default instructionsRoutes.getRouter();
