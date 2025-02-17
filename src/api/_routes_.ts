import fileRoutes from "./files/routes";
import chatRoutes from "./chat.api";
import instructionsRoutes from "./instructions.api";
import samplersRoutes from "./samplers.api";
import templatesRoutes from "./templates.api";
import userPersonsRoutes from "./user-persons.api";
import pipelinesRoutes from "./pipelines.api";

export const routes = [
  chatRoutes,
  userPersonsRoutes,
  samplersRoutes,
  fileRoutes,
  instructionsRoutes,
  templatesRoutes,
  pipelinesRoutes,
];
