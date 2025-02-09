import { ControllerFactory } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { templatesService } from "@services/templates";

const templatesController = new ControllerFactory(
  templatesService.templates,
  templatesService.templatesSettings
);

const templatesRoutes = new RouteFactory(templatesController, "templates");

export default templatesRoutes.getRouter();
