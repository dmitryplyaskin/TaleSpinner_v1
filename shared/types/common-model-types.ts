export type CommonModelItemType = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

export type CommonModelSettingsType = {
  selectedId: string | null;
  enabled: boolean;
  pageSize?: number;
  sortType?: string;
};
