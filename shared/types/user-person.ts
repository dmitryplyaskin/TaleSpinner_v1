import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface UserPerson extends CommonModelItemType {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  prefix?: string;
  imagePath?: string;
  type: "default" | "extended";
  contentTypeDefault?: string;
  contentTypeExtended?: {
    id: string;
    tagName?: string;
    name?: string;
    value: string;
    isEnabled: boolean;
  }[];
}

export interface UserPersonSettings extends CommonModelSettingsType {}
