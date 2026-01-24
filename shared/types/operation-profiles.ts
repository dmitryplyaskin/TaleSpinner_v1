export type OperationHook = "before_main_llm" | "after_main_llm";
export type OperationTrigger = "generate" | "regenerate";

export type OperationExecutionMode = "concurrent" | "sequential";

export type ArtifactPersistence = "persisted" | "run_only";
export type ArtifactUsage = "prompt_only" | "ui_only" | "prompt+ui" | "internal";
export type ArtifactSemantics =
  | "state"
  | "log/feed"
  | "lore/memory"
  | "intermediate"
  | (string & {});

export type OperationKind = "template";

export type OperationTemplateParams = {
  template: string;
  strictVariables?: boolean;
  /**
   * Invariant: to validate single-writer-per-tag at save-time, every operation must
   * explicitly declare where it writes its output.
   *
   * `tag` is stored without the `art.` prefix.
   */
  writeArtifact: {
    tag: string;
    persistence: ArtifactPersistence;
    usage: ArtifactUsage;
    semantics: ArtifactSemantics;
  };
};

export type OperationConfig = {
  enabled: boolean;
  required: boolean;
  hooks: OperationHook[];
  triggers?: OperationTrigger[];
  order: number;
  dependsOn?: string[]; // list of opId
  params: OperationTemplateParams;
};

export type OperationInProfile = {
  opId: string; // UUID
  name: string;
  kind: OperationKind;
  config: OperationConfig;
};

export type OperationProfile = {
  profileId: string; // UUID
  ownerId: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string; // UUID (resettable)
  version: number;
  operations: OperationInProfile[];
  meta: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationProfileUpsertInput = {
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string;
  operations: OperationInProfile[];
  meta?: unknown;
};

export type OperationProfileExport = {
  // `profileId` is intentionally optional on import.
  profileId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string;
  operations: OperationInProfile[];
  meta?: unknown;
};

export type OperationProfileSettings = {
  activeProfileId: string | null;
  updatedAt: Date;
};

