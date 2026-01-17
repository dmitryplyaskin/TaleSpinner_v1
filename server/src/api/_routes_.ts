import chatRoutes from "./agent-cards.api";
import fileRoutes from "./files/routes";
import instructionsRoutes from "./instructions.api";
import llmRoutes from "./llm.api";
import pipelinesRoutes from "./pipelines.api";
import samplersRoutes from "./samplers.api";
import templatesRoutes from "./templates.api";
import userPersonsRoutes from "./user-persons.api";

export const routes = [
  chatRoutes,
  userPersonsRoutes,
  samplersRoutes,
  llmRoutes,
  fileRoutes,
  instructionsRoutes,
  templatesRoutes,
  pipelinesRoutes,
];
