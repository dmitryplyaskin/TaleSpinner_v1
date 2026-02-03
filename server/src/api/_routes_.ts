import chatCoreRoutes from "./chats.core.api";
import chatEntriesRoutes from "./chat-entries.api";
import entityProfilesCoreRoutes from "./entity-profiles.core.api";
import entityProfilesImportRoutes from "./entity-profiles.import.api";
import fileRoutes from "./files/routes";
import generationsCoreRoutes from "./generations.core.api";
import instructionsRoutes from "./instructions.api";
import llmRoutes from "./llm.api";
import messagesCoreRoutes from "./messages.core.api";
import messageVariantsCoreRoutes from "./message-variants.core.api";
import promptTemplatesCoreRoutes from "./prompt-templates.core.api";
import operationProfilesCoreRoutes from "./operation-profiles.core.api";
import samplersRoutes from "./samplers.api";
import userPersonsCoreRoutes from "./user-persons.core.api";

export const routes = [
  entityProfilesCoreRoutes,
  entityProfilesImportRoutes,
  chatCoreRoutes,
  chatEntriesRoutes,
  generationsCoreRoutes,
  messagesCoreRoutes,
  messageVariantsCoreRoutes,
  operationProfilesCoreRoutes,
  userPersonsCoreRoutes,
  samplersRoutes,
  llmRoutes,
  fileRoutes,
  instructionsRoutes,
  promptTemplatesCoreRoutes,
];
