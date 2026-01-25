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

export type OperationKind =
  | "template"
  | "llm"
  | "rag"
  | "tool"
  | "compute"
  | "transform"
  | "legacy";

export type PromptTimeMessageRole = "system" | "developer" | "user" | "assistant";

export type PromptTimeEffect =
  | {
      kind: "append_after_last_user";
      role: PromptTimeMessageRole;
      /**
       * Optional human-readable label to help debug where the injected message came from,
       * e.g. "art.world_state" or "template_output".
       */
      source?: string;
    }
  | {
      kind: "system_update";
      mode: "prepend" | "append" | "replace";
      source?: string;
    }
  | {
      kind: "insert_at_depth";
      /**
       * 0 = insert at tail; -N = insert N messages from the end (closer to tail).
       */
      depthFromEnd: number;
      role: PromptTimeMessageRole;
      source?: string;
    };

export type TurnCanonicalizationEffect = {
  /**
   * Minimal v2 UI placeholder for canonicalization.
   * Current implementation is intentionally narrow and may expand with `effects` contract docs.
   */
  kind: "replace_text";
  /**
   * What part of the current turn to rewrite.
   * - user: current user message (before_main_llm also allowed)
   * - assistant: selected assistant variant (after_main_llm only)
   */
  target: "user" | "assistant";
};

export type ArtifactWriteTarget = {
  /**
   * Invariant: to validate single-writer-per-tag at save-time, every operation must
   * explicitly declare where it writes its output.
   *
   * `tag` is stored without the `art.` prefix.
   */
  tag: string;
  persistence: ArtifactPersistence;
  usage: ArtifactUsage;
  semantics: ArtifactSemantics;
};

export type OperationOutput =
  | {
      type: "artifacts";
      writeArtifact: ArtifactWriteTarget;
    }
  | {
      type: "prompt_time";
      promptTime: PromptTimeEffect;
    }
  | {
      type: "turn_canonicalization";
      canonicalization: TurnCanonicalizationEffect;
    };

export type OperationTemplateParams = {
  template: string;
  strictVariables?: boolean;
  output: OperationOutput;
};

export type OperationOtherKindParams = {
  /**
   * Draft UI for non-template operations:
   * kind-specific params live here as a plain JSON object.
   */
  params: Record<string, unknown>;
  output: OperationOutput;
};

export type OperationParams = OperationTemplateParams | OperationOtherKindParams;

export type OperationConfig<TParams extends OperationParams = OperationParams> = {
  enabled: boolean;
  required: boolean;
  hooks: OperationHook[];
  triggers?: OperationTrigger[];
  order: number;
  dependsOn?: string[]; // list of opId
  params: TParams;
};

export type TemplateOperationInProfile = {
  opId: string; // UUID
  name: string;
  kind: "template";
  config: OperationConfig<OperationTemplateParams>;
};

export type NonTemplateOperationInProfile = {
  opId: string; // UUID
  name: string;
  kind: Exclude<OperationKind, "template">;
  config: OperationConfig<OperationOtherKindParams>;
};

export type OperationInProfile = TemplateOperationInProfile | NonTemplateOperationInProfile;

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

