export interface UserPerson {
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

export interface UserPersonSettings {
  selectedUserPersonId: string | null;
  isUserPersonEnabled: boolean;
}
