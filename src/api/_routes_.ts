import fileRoutes from "./files/routes";
import chatRoutes from "./chat.api";
import instructionsRoutes from "./instructions.api";
import templatesRoutes from "./templates.api";
import userPersonsRoutes from "./user-persons.api";

export const routes = [
  chatRoutes,
  userPersonsRoutes,
  fileRoutes,
  instructionsRoutes,
  templatesRoutes,
];
