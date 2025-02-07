import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface InstructionType extends CommonModelItemType {
  id: string;
  name: string;
  instruction: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface InstructionSettingsType extends CommonModelSettingsType {}
