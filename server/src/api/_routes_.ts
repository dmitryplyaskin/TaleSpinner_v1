import chatEntriesRoutes from "./chat-entries.api";
import chatCoreRoutes from "./chats.core.api";
import entityProfilesCoreRoutes from "./entity-profiles.core.api";
import entityProfilesImportRoutes from "./entity-profiles.import.api";
import fileRoutes from "./files/routes";
import generationsCoreRoutes from "./generations.core.api";
import llmPresetsRoutes from "./llm-presets.api";
import llmRoutes from "./llm.api";
import ragRoutes from "./rag.api";
import operationProfilesCoreRoutes from "./operation-profiles.core.api";
import operationBlocksCoreRoutes from "./operation-blocks.core.api";
import instructionsCoreRoutes from "./instructions.core.api";
import samplersRoutes from "./samplers.api";
import uiThemeCoreRoutes from "./ui-theme.core.api";
import userPersonsCoreRoutes from "./user-persons.core.api";
import worldInfoCoreRoutes from "./world-info.core.api";

export const routes = [
  entityProfilesCoreRoutes,
  entityProfilesImportRoutes,
  chatCoreRoutes,
  chatEntriesRoutes,
  generationsCoreRoutes,
  operationProfilesCoreRoutes,
  operationBlocksCoreRoutes,
  userPersonsCoreRoutes,
  samplersRoutes,
  llmRoutes,
  ragRoutes,
  llmPresetsRoutes,
  fileRoutes,
  instructionsCoreRoutes,
  uiThemeCoreRoutes,
  worldInfoCoreRoutes,
];
