export const worldInfoScopes = [
  "global",
  "chat",
  "entity_profile",
  "persona",
] as const;
export type WorldInfoScope = (typeof worldInfoScopes)[number];

export const worldInfoBindingRoles = ["primary", "additional"] as const;
export type WorldInfoBindingRole = (typeof worldInfoBindingRoles)[number];

export const worldInfoBookSources = ["native", "imported", "converted"] as const;
export type WorldInfoBookSource = (typeof worldInfoBookSources)[number];

export const worldInfoEffectTypes = ["sticky", "cooldown"] as const;
export type WorldInfoEffectType = (typeof worldInfoEffectTypes)[number];

export const worldInfoGenerationTriggers = [
  "normal",
  "continue",
  "impersonate",
  "swipe",
  "regenerate",
  "quiet",
] as const;
export type WorldInfoGenerationTrigger = (typeof worldInfoGenerationTriggers)[number];
export type WorldInfoRuntimeTrigger = WorldInfoGenerationTrigger;
export type WorldInfoInsertionStrategy = 0 | 1 | 2;

export type WorldInfoSecondaryLogic = 0 | 1 | 2 | 3;
export type WorldInfoPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WorldInfoRole = 0 | 1 | 2;

export type WorldInfoCharacterFilter = {
  isExclude: boolean;
  names: string[];
  tags: string[];
};

export type WorldInfoEntry = {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: WorldInfoSecondaryLogic;
  addMemo: boolean;
  order: number;
  position: WorldInfoPosition;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  delayUntilRecursion: number | boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  outletName: string;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: WorldInfoRole;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  triggers: WorldInfoGenerationTrigger[];
  characterFilter: WorldInfoCharacterFilter;
  extensions: Record<string, unknown>;
};

export type WorldInfoBookData = {
  name?: string;
  entries: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

export type WorldInfoBookDto = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  data: WorldInfoBookData;
  extensions: Record<string, unknown> | null;
  source: WorldInfoBookSource;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type WorldInfoBookSummaryDto = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  source: WorldInfoBookSource;
  version: number;
  updatedAt: Date;
};

export type WorldInfoSettingsDto = {
  ownerId: string;
  scanDepth: number;
  minActivations: number;
  minDepthMax: number;
  minActivationsDepthMax: number;
  budgetPercent: number;
  budgetCapTokens: number;
  contextWindowTokens: number;
  includeNames: boolean;
  recursive: boolean;
  overflowAlert: boolean;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  insertionStrategy: WorldInfoInsertionStrategy;
  characterStrategy: WorldInfoInsertionStrategy;
  maxRecursionSteps: number;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorldInfoBindingDto = {
  id: string;
  ownerId: string;
  scope: WorldInfoScope;
  scopeId: string | null;
  bookId: string;
  bindingRole: WorldInfoBindingRole;
  displayOrder: number;
  enabled: boolean;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorldInfoTimedEffectDto = {
  id: string;
  ownerId: string;
  chatId: string;
  branchId: string;
  entryHash: string;
  bookId: string | null;
  entryUid: number | null;
  effectType: WorldInfoEffectType;
  startMessageIndex: number;
  endMessageIndex: number;
  protected: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PreparedWorldInfoEntry = WorldInfoEntry & {
  bookId: string;
  bookName: string;
  hash: string;
  decorators: {
    activate: boolean;
    dontActivate: boolean;
  };
};

export type WorldInfoDepthEntry = {
  depth: number;
  role: WorldInfoRole;
  content: string;
  bookId: string;
  uid: number;
};

export type WorldInfoResolveDebug = {
  warnings: string[];
  matchedKeys: Record<string, string[]>;
  skips: Array<{ hash: string; reason: string }>;
  budget: {
    limit: number;
    used: number;
    overflowed: boolean;
  };
};

export type WorldInfoResolvePromptOutput = {
  worldInfoBefore: string;
  worldInfoAfter: string;
  depthEntries: WorldInfoDepthEntry[];
  outletEntries: Record<string, string[]>;
  anTop: string[];
  anBottom: string[];
  emTop: string[];
  emBottom: string[];
};

export type WorldInfoResolveResult = WorldInfoResolvePromptOutput & {
  activatedEntries: PreparedWorldInfoEntry[];
  debug: WorldInfoResolveDebug;
};
