import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface PipelineItemType {
  id: string;
  name: string;
  tag: string;
  enabled: boolean;
  prompt: string;
  outputType?: string;
  showToUserInChat?: boolean;
  addToChatHistory?: boolean;
  addToPrompt?: boolean;
}

export interface PipelineType extends CommonModelItemType {
  id: string;
  name: string;
  pipelines: PipelineItemType[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineSettingsType extends CommonModelSettingsType {}
