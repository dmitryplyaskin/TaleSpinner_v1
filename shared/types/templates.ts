import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface TemplateType extends CommonModelItemType {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface TemplateSettingsType extends CommonModelSettingsType {}
