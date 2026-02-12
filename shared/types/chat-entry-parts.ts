export type EntryRole = "system" | "user" | "assistant";

export type PartChannel = "main" | "reasoning" | "aux" | "trace";

export type PartPayloadFormat = "text" | "markdown" | "json";

export type PartVisibilityUi = "always" | "debug" | "never";

export type PartVisibility = {
  ui: PartVisibilityUi;
  prompt: boolean;
};

export type PartLifespan = "infinite" | { turns: number };

export type PartSource = "llm" | "agent" | "user" | "import";

export type Entry = {
  entryId: string;
  chatId: string;
  branchId: string;
  role: EntryRole;
  createdAt: number;
  activeVariantId: string;

  softDeleted?: boolean;
  softDeletedAt?: number;
  softDeletedBy?: "user" | "agent";

  meta?: {
    imported?: boolean;
    pinned?: boolean;
    excludedFromPrompt?: boolean;
    [key: string]: unknown;
  };
};

export type VariantKind = "generation" | "manual_edit" | "import";

export type Variant = {
  variantId: string;
  entryId: string;
  kind: VariantKind;
  createdAt: number;
  parts: Part[];

  derived?: {
    generationId?: string;
    promptHash?: string;
    [key: string]: unknown;
  };
};

export type Part = {
  partId: string;
  channel: PartChannel;
  order: number;

  payload: string | object;
  payloadFormat: PartPayloadFormat;
  schemaId?: string;
  label?: string;

  visibility: PartVisibility;

  ui?: {
    rendererId: string;
    props?: Record<string, unknown>;
  };

  prompt?: {
    serializerId: string;
    props?: Record<string, unknown>;
  };

  lifespan: PartLifespan;
  createdTurn: number;

  source: PartSource;
  agentId?: string;
  model?: string;
  requestId?: string;

  replacesPartId?: string;

  softDeleted?: boolean;
  softDeletedAt?: number;
  softDeletedBy?: "user" | "agent";

  tags?: string[];
};

// --- DTOs for API boundaries (v1)

export type ChatEntryDto = {
  entryId: string;
  chatId: string;
  branchId: string;
  role: EntryRole;
  createdAt: number;
  activeVariantId: string;
  softDeleted?: boolean;
  meta?: unknown | null;
};

export type EntryVariantDto = {
  variantId: string;
  entryId: string;
  kind: VariantKind;
  createdAt: number;
  parts: Part[];
  derived?: unknown | null;
};

