import {
  CommonModelItemType,
  CommonModelSettingsType,
} from "./common-model-types";

export interface UserPersonContentTypeExtendedLegacyItem {
  id: string;
  tagName?: string;
  name?: string;
  value: string;
  isEnabled: boolean;
}

export interface UserPersonAdditionalConnectionsRule {
  enabled?: boolean;
  chats?: string[];
  entities?: string[];
}

export interface UserPersonAdditionalMatchRule {
  enabled?: boolean;
  query?: string;
}

export interface UserPersonAdditionalAdvancedState {
  advancedOpen?: boolean;
  connections?: UserPersonAdditionalConnectionsRule;
  match?: UserPersonAdditionalMatchRule;
}

export interface UserPersonContentTypeExtendedV2Item {
  type: "item";
  id: string;
  title: string;
  text: string;
  enabled: boolean;
  collapsed: boolean;
  adv?: UserPersonAdditionalAdvancedState;
}

export interface UserPersonContentTypeExtendedV2Group {
  type: "group";
  id: string;
  title: string;
  enabled: boolean;
  collapsed: boolean;
  items: UserPersonContentTypeExtendedV2Item[];
  adv?: UserPersonAdditionalAdvancedState;
}

export type UserPersonContentTypeExtendedV2Block =
  | UserPersonContentTypeExtendedV2Item
  | UserPersonContentTypeExtendedV2Group;

export interface UserPersonContentTypeExtendedV2Settings {
  additionalJoiner: string;
  wrapperEnabled: boolean;
  wrapperTemplate: string;
}

export interface UserPersonContentTypeExtendedV2 {
  version: 2;
  baseDescription: string;
  settings: UserPersonContentTypeExtendedV2Settings;
  blocks: UserPersonContentTypeExtendedV2Block[];
}

export type UserPersonContentTypeExtended =
  | UserPersonContentTypeExtendedV2
  | UserPersonContentTypeExtendedLegacyItem[];

export interface UserPersonType extends CommonModelItemType {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  prefix?: string;
  imagePath?: string;
  type: "default" | "extended";
  contentTypeDefault?: string;
  contentTypeExtended?: UserPersonContentTypeExtended;
}

export interface UserPersonSettingsType extends CommonModelSettingsType {}
