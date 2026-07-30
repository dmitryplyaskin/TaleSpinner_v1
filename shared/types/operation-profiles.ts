import type {
  KnowledgeRevealOperationParams,
  KnowledgeSearchOperationParams,
} from "./chat-knowledge";

export type OperationHook = "before_main_llm" | "after_main_llm";
export type OperationTrigger = "generate" | "regenerate";

export type OperationExecutionMode = "concurrent" | "sequential";

export type ArtifactFormat = "text" | "markdown" | "json";
export type ArtifactPersistence = "persisted" | "run_only";
export type ArtifactWriteMode = "replace" | "append";
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
  | "guard"
  | "knowledge_search"
  | "knowledge_reveal"
  | "rag"
  | "tool"
  | "compute"
  | "transform";

export type PromptTimeMessageRole = "system" | "user" | "assistant";

export type PromptPartExposure = {
  type: "prompt_part";
  target: "system";
  mode: "prepend" | "append" | "replace";
  source?: string;
};

export type PromptMessageExposure =
  | {
      type: "prompt_message";
      role: PromptTimeMessageRole;
      anchor: "after_last_user";
      source?: string;
    }
  | {
      type: "prompt_message";
      role: PromptTimeMessageRole;
      anchor: "depth_from_end";
      depthFromEnd: number;
      source?: string;
    };

export type TurnRewriteExposure = {
  type: "turn_rewrite";
  target: "current_user_main" | "assistant_output_main";
  mode: "replace";
};

export type UiInlineExposure =
  | {
      type: "ui_inline";
      role: PromptTimeMessageRole;
      anchor: "after_last_user";
      source?: string;
    }
  | {
      type: "ui_inline";
      role: PromptTimeMessageRole;
      anchor: "depth_from_end";
      depthFromEnd: number;
      source?: string;
    };

export type ArtifactExposure =
  | PromptPartExposure
  | PromptMessageExposure
  | TurnRewriteExposure
  | UiInlineExposure;

export type OperationArtifactConfig = {
  artifactId: string;
  tag: string;
  title: string;
  description?: string;
  format: ArtifactFormat;
  persistence: ArtifactPersistence;
  writeMode: ArtifactWriteMode;
  history: {
    enabled: boolean;
    maxItems: number;
  };
  semantics?: ArtifactSemantics;
  exposures: ArtifactExposure[];
};

export type LegacyPromptTimeEffect =
  | {
      kind: "append_after_last_user";
      role: PromptTimeMessageRole;
      source?: string;
    }
  | {
      kind: "system_update";
      mode: "prepend" | "append" | "replace";
      source?: string;
    }
  | {
      kind: "insert_at_depth";
      depthFromEnd: number;
      role: PromptTimeMessageRole;
      source?: string;
    };

export type LegacyTurnCanonicalizationEffect = {
  kind: "replace_text";
  target: "user" | "assistant";
};

export type LegacyArtifactWriteTarget = {
  tag: string;
  persistence: ArtifactPersistence;
  usage: ArtifactUsage;
  semantics: ArtifactSemantics;
};

export type LegacyOperationOutput =
  | {
      type: "artifacts";
      writeArtifact: LegacyArtifactWriteTarget;
    }
  | {
      type: "prompt_time";
      promptTime: LegacyPromptTimeEffect;
    }
  | {
      type: "turn_canonicalization";
      canonicalization: LegacyTurnCanonicalizationEffect;
    };

export type OperationTemplateParams = {
  template: string;
  strictVariables?: boolean;
  artifact: OperationArtifactConfig;
};

export type OperationTemplateLegacyParams = {
  template: string;
  strictVariables?: boolean;
  output: LegacyOperationOutput;
};

export type LlmOperationRetryOn = "timeout" | "provider_error" | "rate_limit";
export type LlmJsonParseMode = "raw" | "markdown_code_block" | "custom_regex";
export type LlmOperationReasoningEffort = "low" | "medium" | "high";

export type LlmOperationReasoning = {
  enabled?: boolean;
  effort?: LlmOperationReasoningEffort;
  maxTokens?: number;
  exclude?: boolean;
};

export type LlmOperationSamplers = {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  topA?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  seed?: number;
  maxTokens?: number;
  reasoning?: LlmOperationReasoning;
};

export type LlmOperationRetry = {
  maxAttempts: number;
  backoffMs?: number;
  retryOn?: LlmOperationRetryOn[];
};

export type LlmOperationParams = {
  providerId: "openrouter" | "openai_compatible";
  credentialRef: string;
  model?: string;
  llmPresetId?: string;
  system?: string;
  prompt: string;
  strictVariables?: boolean;
  outputMode?: "text" | "json";
  jsonSchema?: unknown;
  strictSchemaValidation?: boolean;
  jsonParseMode?: LlmJsonParseMode;
  jsonCustomPattern?: string;
  jsonCustomFlags?: string;
  samplerPresetId?: string;
  samplers?: LlmOperationSamplers;
  timeoutMs?: number;
  retry?: LlmOperationRetry;
};

export type GuardEngine = "liquid" | "aux_llm";

export type GuardOutputDefinition = {
  key: string;
  title: string;
  description?: string;
};

export type GuardOutputContract = GuardOutputDefinition[];

export type GuardLiquidParams = {
  engine: "liquid";
  outputContract: GuardOutputContract;
  template: string;
  strictVariables?: boolean;
  artifact: OperationArtifactConfig;
};

export type GuardAuxLlmParams = {
  engine: "aux_llm";
  outputContract: GuardOutputContract;
  providerId: "openrouter" | "openai_compatible";
  credentialRef: string;
  model?: string;
  system?: string;
  prompt: string;
  strictVariables?: boolean;
  samplers?: LlmOperationSamplers;
  timeoutMs?: number;
  retry?: LlmOperationRetry;
  artifact: OperationArtifactConfig;
};

export type GuardOperationParams = GuardLiquidParams | GuardAuxLlmParams;

export type OperationOtherKindParams<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  params: TParams;
  artifact: OperationArtifactConfig;
};

export type OperationOtherKindLegacyParams<TParams extends Record<string, unknown> = Record<string, unknown>> = {
  params: TParams;
  output: LegacyOperationOutput;
};

export type OperationRunCondition =
  | {
      type: "guard_output";
      sourceOpId: string;
      outputKey: string;
      operator: "is_true";
    }
  | {
      type: "guard_output";
      sourceOpId: string;
      outputKey: string;
      operator: "is_false";
    };

export type OperationParams =
  | OperationTemplateParams
  | OperationGuardOperationParamsCompat
  | OperationOtherKindParams;

type OperationGuardOperationParamsCompat = GuardOperationParams;

export type OperationActivationConfig = {
  everyNTurns?: number;
  everyNContextTokens?: number;
};

export type OperationConfig<TParams extends OperationParams = OperationParams> = {
  enabled: boolean;
  required: boolean;
  hooks: OperationHook[];
  triggers?: OperationTrigger[];
  activation?: OperationActivationConfig;
  order: number;
  dependsOn?: string[];
  runConditions?: OperationRunCondition[];
  params: TParams;
};

export type TemplateOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: "template";
  config: OperationConfig<OperationTemplateParams>;
};

export type LlmOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: "llm";
  config: OperationConfig<OperationOtherKindParams<LlmOperationParams>>;
};

export type GuardOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: "guard";
  config: OperationConfig<GuardOperationParams>;
};

export type KnowledgeSearchOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: "knowledge_search";
  config: OperationConfig<OperationOtherKindParams<KnowledgeSearchOperationParams>>;
};

export type KnowledgeRevealOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: "knowledge_reveal";
  config: OperationConfig<OperationOtherKindParams<KnowledgeRevealOperationParams>>;
};

export type GenericNonTemplateOperationInProfile = {
  opId: string;
  name: string;
  description?: string;
  kind: Exclude<
    OperationKind,
    "template" | "llm" | "guard" | "knowledge_search" | "knowledge_reveal"
  >;
  config: OperationConfig<OperationOtherKindParams>;
};

export type NonTemplateOperationInProfile =
  | LlmOperationInProfile
  | GuardOperationInProfile
  | KnowledgeSearchOperationInProfile
  | KnowledgeRevealOperationInProfile
  | GenericNonTemplateOperationInProfile;

export type OperationInProfile = TemplateOperationInProfile | NonTemplateOperationInProfile;

export type OperationBlock = {
  blockId: string;
  ownerId: string;
  name: string;
  description?: string;
  enabled: boolean;
  version: number;
  operations: OperationInProfile[];
  meta: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationBlockUpsertInput = {
  name: string;
  description?: string;
  enabled: boolean;
  operations: OperationInProfile[];
  meta?: unknown;
};

export type OperationBlockExport = {
  blockId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  operations: OperationInProfile[];
  meta?: unknown;
};

export type OperationProfileBlockRef = {
  blockId: string;
  enabled: boolean;
  order: number;
};

export type OperationProfile = {
  profileId: string;
  ownerId: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string;
  version: number;
  operations?: OperationInProfile[];
  blockRefs: OperationProfileBlockRef[];
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
  blockRefs: OperationProfileBlockRef[];
  meta?: unknown;
};

export type OperationProfileBundleProfile = {
  profileId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string;
  blockRefs: OperationProfileBlockRef[];
  meta?: unknown;
};

export type OperationProfileExportV2 = {
  type: "operation_profile_bundle";
  version: 2;
  profile: OperationProfileBundleProfile;
  blocks: OperationBlockExport[];
};

export type OperationProfileLegacyExportV1 = {
  profileId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  executionMode: OperationExecutionMode;
  operationProfileSessionId: string;
  operations: OperationInProfile[];
  meta?: unknown;
};

export type OperationProfileExport = OperationProfileExportV2;

export type OperationProfileSettings = {
  activeProfileId: string | null;
  updatedAt: Date;
};

const DEFAULT_ARTIFACT_HISTORY_MAX_ITEMS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = asFiniteNumber(value);
  if (typeof parsed === "undefined") return fallback;
  return Math.max(1, Math.floor(parsed));
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = asFiniteNumber(value);
  if (typeof parsed === "undefined") return fallback;
  return Math.max(0, Math.floor(Math.abs(parsed)));
}

function normalizePromptRole(value: unknown): PromptTimeMessageRole {
  if (value === "system" || value === "user" || value === "assistant") return value;
  if (value === "developer") return "system";
  return "system";
}

export function buildOperationArtifactId(opId: string): string {
  return `artifact:${opId}`;
}

function sanitizeArtifactTagSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function buildDefaultArtifactTag(params: { opId: string; title?: string }): string {
  const fromTitle = typeof params.title === "string" ? sanitizeArtifactTagSegment(params.title) : "";
  if (/^[a-z][a-z0-9_]*$/.test(fromTitle)) return fromTitle;

  const suffix = params.opId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8) || "item";
  return `artifact_${suffix}`;
}

function normalizeArtifactTag(value: unknown, fallback: string): string {
  const normalized = typeof value === "string" ? sanitizeArtifactTagSegment(value) : "";
  return /^[a-z][a-z0-9_]*$/.test(normalized) ? normalized : fallback;
}

export function inferDefaultArtifactFormat(params: {
  kind: OperationKind;
  llmOutputMode?: "text" | "json";
}): ArtifactFormat {
  if (params.kind === "guard") return "json";
  if (params.kind === "llm" && params.llmOutputMode === "json") return "json";
  return "markdown";
}

export function makeDefaultOperationArtifactConfig(params: {
  opId: string;
  kind: OperationKind;
  llmOutputMode?: "text" | "json";
  title?: string;
}): OperationArtifactConfig {
  return {
    artifactId: buildOperationArtifactId(params.opId),
    tag: buildDefaultArtifactTag({ opId: params.opId, title: params.title }),
    title: params.title?.trim() || `Artifact ${params.opId.slice(0, 8)}`,
    format: inferDefaultArtifactFormat({
      kind: params.kind,
      llmOutputMode: params.llmOutputMode,
    }),
    persistence: "run_only",
    writeMode: "replace",
    history: {
      enabled: true,
      maxItems: DEFAULT_ARTIFACT_HISTORY_MAX_ITEMS,
    },
    exposures: [],
  };
}

function normalizeExposure(raw: unknown): ArtifactExposure | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;

  if (raw.type === "prompt_part") {
    const mode =
      raw.mode === "prepend" || raw.mode === "append" || raw.mode === "replace"
        ? raw.mode
        : "append";
    return {
      type: "prompt_part",
      target: "system",
      mode,
      ...(asString(raw.source)?.trim() ? { source: asString(raw.source)!.trim() } : {}),
    };
  }

  if (raw.type === "prompt_message" || raw.type === "ui_inline") {
    const anchor =
      raw.anchor === "depth_from_end" || raw.anchor === "after_last_user"
        ? raw.anchor
        : "after_last_user";
    const base = {
      type: raw.type,
      role: normalizePromptRole(raw.role),
      ...(asString(raw.source)?.trim() ? { source: asString(raw.source)!.trim() } : {}),
    } as const;
    if (anchor === "depth_from_end") {
      return {
        ...base,
        anchor,
        depthFromEnd: normalizeNonNegativeInteger(raw.depthFromEnd),
      } as ArtifactExposure;
    }
    return {
      ...base,
      anchor,
    } as ArtifactExposure;
  }

  if (raw.type === "turn_rewrite") {
    return {
      type: "turn_rewrite",
      target:
        raw.target === "assistant_output_main" ? "assistant_output_main" : "current_user_main",
      mode: "replace",
    };
  }

  return null;
}

function legacyOutputToArtifactConfig(params: {
  opId: string;
  kind: OperationKind;
  title?: string;
  llmOutputMode?: "text" | "json";
  output: LegacyOperationOutput;
}): OperationArtifactConfig {
  const base = makeDefaultOperationArtifactConfig({
    opId: params.opId,
    kind: params.kind,
    llmOutputMode: params.llmOutputMode,
    title: params.title,
  });

  if (params.output.type === "artifacts") {
    return {
      ...base,
      tag: normalizeArtifactTag(params.output.writeArtifact.tag, base.tag),
      persistence: params.output.writeArtifact.persistence,
      semantics: params.output.writeArtifact.semantics,
    };
  }

  if (params.output.type === "prompt_time") {
    if (params.output.promptTime.kind === "system_update") {
      return {
        ...base,
        exposures: [
          {
            type: "prompt_part",
            target: "system",
            mode: params.output.promptTime.mode,
            ...(params.output.promptTime.source
              ? { source: params.output.promptTime.source }
              : {}),
          },
        ],
      };
    }

    if (params.output.promptTime.kind === "append_after_last_user") {
      return {
        ...base,
        exposures: [
          {
            type: "prompt_message",
            role: params.output.promptTime.role,
            anchor: "after_last_user",
            ...(params.output.promptTime.source
              ? { source: params.output.promptTime.source }
              : {}),
          },
        ],
      };
    }

    return {
      ...base,
      exposures: [
        {
          type: "prompt_message",
          role: params.output.promptTime.role,
          anchor: "depth_from_end",
          depthFromEnd: normalizeNonNegativeInteger(params.output.promptTime.depthFromEnd),
          ...(params.output.promptTime.source ? { source: params.output.promptTime.source } : {}),
        },
      ],
    };
  }

  return {
    ...base,
    exposures: [
      {
        type: "turn_rewrite",
        target:
          params.output.canonicalization.target === "assistant"
            ? "assistant_output_main"
            : "current_user_main",
        mode: "replace",
      },
    ],
  };
}

export function normalizeOperationArtifactConfig(params: {
  opId: string;
  kind: OperationKind;
  title?: string;
  rawParams: unknown;
}): OperationArtifactConfig {
  const llmOutputMode =
    isRecord(params.rawParams) &&
    isRecord(params.rawParams.params) &&
    params.rawParams.params.outputMode === "json"
      ? "json"
      : "text";
  const fallback = makeDefaultOperationArtifactConfig({
    opId: params.opId,
    kind: params.kind,
    llmOutputMode,
    title: params.title,
  });

  if (!isRecord(params.rawParams)) {
    return fallback;
  }

  if (isRecord(params.rawParams.artifact)) {
    const artifact = params.rawParams.artifact;
    const exposures = Array.isArray(artifact.exposures)
      ? artifact.exposures
          .map((item) => normalizeExposure(item))
          .filter((item): item is ArtifactExposure => Boolean(item))
      : [];
    const rawArtifactId = asString(artifact.artifactId)?.trim();
    const rawTag = asString(artifact.tag)?.trim();
    const migratedLegacyTag = !rawTag && rawArtifactId && !rawArtifactId.startsWith("artifact:") ? rawArtifactId : undefined;
    return {
      artifactId:
        rawArtifactId && !migratedLegacyTag ? rawArtifactId : fallback.artifactId,
      tag: normalizeArtifactTag(rawTag ?? migratedLegacyTag, fallback.tag),
      title: asString(artifact.title)?.trim() || fallback.title,
      description: asString(artifact.description)?.trim() || undefined,
      format:
        artifact.format === "text" || artifact.format === "markdown" || artifact.format === "json"
          ? artifact.format
          : fallback.format,
      persistence:
        artifact.persistence === "persisted" || artifact.persistence === "run_only"
          ? artifact.persistence
          : fallback.persistence,
      writeMode:
        artifact.writeMode === "append" || artifact.writeMode === "replace"
          ? artifact.writeMode
          : fallback.writeMode,
      history: {
        enabled: asBoolean(isRecord(artifact.history) ? artifact.history.enabled : undefined) ?? true,
        maxItems: normalizePositiveInteger(
          isRecord(artifact.history) ? artifact.history.maxItems : undefined,
          fallback.history.maxItems
        ),
      },
      semantics: asString(artifact.semantics)?.trim() || undefined,
      exposures,
    };
  }

  if (isRecord(params.rawParams.output) && typeof params.rawParams.output.type === "string") {
    return legacyOutputToArtifactConfig({
      opId: params.opId,
      kind: params.kind,
      title: params.title,
      llmOutputMode,
      output: params.rawParams.output as LegacyOperationOutput,
    });
  }

  if (isRecord(params.rawParams.writeArtifact)) {
    return legacyOutputToArtifactConfig({
      opId: params.opId,
      kind: params.kind,
      title: params.title,
      llmOutputMode,
      output: {
        type: "artifacts",
        writeArtifact: params.rawParams.writeArtifact as LegacyArtifactWriteTarget,
      },
    });
  }

  return fallback;
}
