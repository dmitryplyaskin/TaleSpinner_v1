import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface SamplerItemSettingsType {
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxTokens: number;
  stopSequences: string[];
  seed: number;
  [key: string]: any;
}

export interface SamplersItemType extends CommonModelItemType {
  id: string;
  name: string;
  settings: SamplerItemSettingsType;
  createdAt: string;
  updatedAt: string;
}

export interface SamplersSettingsType extends CommonModelSettingsType {}
