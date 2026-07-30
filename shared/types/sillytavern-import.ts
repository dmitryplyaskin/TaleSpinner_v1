export type SillyTavernImportKind =
  | "character"
  | "persona"
  | "world_info"
  | "instruction"
  | "sampler"
  | "chat";

export type SillyTavernImportSourceMeta = {
  source: "sillytavern";
  kind: SillyTavernImportKind;
  profileHandle: string;
  relativePath: string;
  contentHash: string;
  size: number;
  mtimeMs: number;
  importedAt?: string;
};

export type SillyTavernImportScanItem = SillyTavernImportSourceMeta & {
  id: string;
  name: string;
  details?: string;
  dependencyIds?: string[];
};

export type SillyTavernImportScanProfile = {
  handle: string;
  rootRelativePath: string;
  items: Record<SillyTavernImportKind, SillyTavernImportScanItem[]>;
  unsupported: Record<string, number>;
};

export type SillyTavernImportScanResult = {
  rootPath: string;
  profiles: SillyTavernImportScanProfile[];
  totals: Record<SillyTavernImportKind, number>;
};

export type SillyTavernImportSelection = {
  itemIds: string[];
};

export type SillyTavernImportScanRequest = {
  rootPath: string;
};

export type SillyTavernImportRequest = {
  rootPath: string;
  selection: SillyTavernImportSelection;
  ownerId?: string;
};

export type SillyTavernImportCreatedItem = {
  kind: SillyTavernImportKind;
  itemId: string;
  targetId: string;
  name: string;
};

export type SillyTavernImportSkippedItem = {
  kind: SillyTavernImportKind;
  itemId: string;
  name: string;
  reason: "duplicate" | "not_selected" | "unsupported_dependency";
};

export type SillyTavernImportFailedItem = {
  kind: SillyTavernImportKind;
  itemId: string;
  name: string;
  error: string;
};

export type SillyTavernImportResult = {
  created: SillyTavernImportCreatedItem[];
  skipped: SillyTavernImportSkippedItem[];
  failed: SillyTavernImportFailedItem[];
};
