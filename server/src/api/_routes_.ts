import chatCoreRoutes from "./chats.core.api";
import entityProfilesCoreRoutes from "./entity-profiles.core.api";
import entityProfilesImportRoutes from "./entity-profiles.import.api";
import fileRoutes from "./files/routes";
import generationsCoreRoutes from "./generations.core.api";
import instructionsRoutes from "./instructions.api";
import llmRoutes from "./llm.api";
import messagesCoreRoutes from "./messages.core.api";
import messageVariantsCoreRoutes from "./message-variants.core.api";
import pipelineDebugCoreRoutes from "./pipeline-debug.core.api";
import pipelineProfilesCoreRoutes from "./pipeline-profiles.core.api";
import pipelineStateCoreRoutes from "./pipeline-state.core.api";
import pipelinesRoutes from "./pipelines.api";
import promptTemplatesCoreRoutes from "./prompt-templates.core.api";
import samplersRoutes from "./samplers.api";
import userPersonsCoreRoutes from "./user-persons.core.api";

export const routes = [
  entityProfilesCoreRoutes,
  entityProfilesImportRoutes,
  chatCoreRoutes,
  generationsCoreRoutes,
  messagesCoreRoutes,
  messageVariantsCoreRoutes,
  pipelineDebugCoreRoutes,
  pipelineProfilesCoreRoutes,
  pipelineStateCoreRoutes,
  userPersonsCoreRoutes,
  samplersRoutes,
  llmRoutes,
  fileRoutes,
  instructionsRoutes,
  promptTemplatesCoreRoutes,
  pipelinesRoutes,
];
