import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { pipelinesService } from "@services/pipelines.service";

const pipelinesController = new GeneralController(
  pipelinesService.pipelines,
  pipelinesService.pipelinesSettings
);

const pipelinesRoutes = new RouteFactory(
  { general: pipelinesController },
  "pipelines"
);

export default pipelinesRoutes.getRouter();
