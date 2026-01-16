import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { templatesService } from "@services/templates.service";

const templatesController = new GeneralController(
  templatesService.templates,
  templatesService.templatesSettings
);

const templatesRoutes = new RouteFactory(
  { general: templatesController },
  "templates"
);

export default templatesRoutes.getRouter();
