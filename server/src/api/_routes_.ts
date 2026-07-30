import appBackgroundsRoutes from "./app-backgrounds.core.api";
import appSettingsRoutes from "./app-settings.api";
import bundlesCoreRoutes from "./bundles.core.api";
import chatEntriesRoutes from "./chat-entries.api";
import chatKnowledgeCoreRoutes from "./chat-knowledge.core.api";
import chatCoreRoutes from "./chats.core.api";
import entityProfilesCoreRoutes from "./entity-profiles.core.api";
import entityProfilesImportRoutes from "./entity-profiles.import.api";
import fileRoutes from "./files/routes";
import generateRoutes from "./generate.api";
import generationsCoreRoutes from "./generations.core.api";
import instructionsCoreRoutes from "./instructions.core.api";
import llmPresetsRoutes from "./llm-presets.api";
import llmRoutes from "./llm.api";
import modelsRoutes from "./models.api";
import operationBlocksCoreRoutes from "./operation-blocks.core.api";
import operationProfilesCoreRoutes from "./operation-profiles.core.api";
import ragChromaRoutes from "./rag-chroma.api";
import ragRoutes from "./rag.api";
import samplersRoutes from "./samplers.api";
import settingsRoutes from "./settings.api";
import sidebarsRoutes from "./sidebars.api";
import sillytavernImportRoutes from "./sillytavern-import.api";
import uiThemeCoreRoutes from "./ui-theme.core.api";
import userPersonsCoreRoutes from "./user-persons.core.api";
import worldInfoCoreRoutes from "./world-info.core.api";

export const routes = [
  bundlesCoreRoutes,
  entityProfilesCoreRoutes,
  entityProfilesImportRoutes,
  chatCoreRoutes,
  chatKnowledgeCoreRoutes,
  chatEntriesRoutes,
  generationsCoreRoutes,
  operationProfilesCoreRoutes,
  operationBlocksCoreRoutes,
  userPersonsCoreRoutes,
  samplersRoutes,
  llmRoutes,
  modelsRoutes,
  settingsRoutes,
  appSettingsRoutes,
  appBackgroundsRoutes,
  generateRoutes,
  sidebarsRoutes,
  sillytavernImportRoutes,
  ragRoutes,
  ragChromaRoutes,
  llmPresetsRoutes,
  fileRoutes,
  instructionsCoreRoutes,
  uiThemeCoreRoutes,
  worldInfoCoreRoutes,
];
