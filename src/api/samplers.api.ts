import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { samplersService } from "@services/samplers.service";

const samplersController = new GeneralController(
  samplersService.samplers,
  samplersService.samplersSettings
);

const samplersRoutes = new RouteFactory(
  { general: samplersController },
  "samplers"
);

export default samplersRoutes.getRouter();
