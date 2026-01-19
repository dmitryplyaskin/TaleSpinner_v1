import chatRoutes from "./agent-cards.api";
import chatCoreRoutes from "./chats.core.api";
import entityProfilesCoreRoutes from "./entity-profiles.core.api";
import fileRoutes from "./files/routes";
import instructionsRoutes from "./instructions.api";
import llmRoutes from "./llm.api";
import pipelinesRoutes from "./pipelines.api";
import samplersRoutes from "./samplers.api";
import templatesRoutes from "./templates.api";
import userPersonsRoutes from "./user-persons.api";

export const routes = [
  chatRoutes,
  entityProfilesCoreRoutes,
  chatCoreRoutes,
  userPersonsRoutes,
  samplersRoutes,
  llmRoutes,
  fileRoutes,
  instructionsRoutes,
  templatesRoutes,
  pipelinesRoutes,
];
