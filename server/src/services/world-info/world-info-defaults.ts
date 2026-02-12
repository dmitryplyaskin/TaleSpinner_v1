import type {
  WorldInfoCharacterFilter,
  WorldInfoEntry,
  WorldInfoSettingsDto,
} from "./world-info-types";

export const DEFAULT_WORLD_INFO_OWNER_ID = "global";
export const MAX_WORLD_INFO_BOOK_BYTES = 5 * 1024 * 1024;
export const MAX_WORLD_INFO_ENTRIES_PER_BOOK = 10_000;
export const MAX_WORLD_INFO_ENTRY_CONTENT_CHARS = 20_000;

export const DEFAULT_WORLD_INFO_CHARACTER_FILTER: WorldInfoCharacterFilter = {
  isExclude: false,
  names: [],
  tags: [],
};

export const DEFAULT_WORLD_INFO_ENTRY: Omit<WorldInfoEntry, "uid" | "content"> = {
  key: [],
  keysecondary: [],
  comment: "",
  constant: false,
  vectorized: false,
  selective: true,
  selectiveLogic: 0,
  addMemo: false,
  order: 100,
  position: 0,
  disable: false,
  ignoreBudget: false,
  excludeRecursion: false,
  preventRecursion: false,
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
  delayUntilRecursion: 0,
  probability: 100,
  useProbability: true,
  depth: 4,
  outletName: "",
  group: "",
  groupOverride: false,
  groupWeight: 100,
  scanDepth: null,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  automationId: "",
  role: 0,
  sticky: null,
  cooldown: null,
  delay: null,
  triggers: [],
  characterFilter: DEFAULT_WORLD_INFO_CHARACTER_FILTER,
  extensions: {},
};

export const DEFAULT_WORLD_INFO_BOOK_DATA = {
  entries: {},
  extensions: {},
};

export function buildDefaultWorldInfoSettings(ownerId = DEFAULT_WORLD_INFO_OWNER_ID): Omit<
  WorldInfoSettingsDto,
  "createdAt" | "updatedAt"
> {
  return {
    ownerId,
    scanDepth: 2,
    minActivations: 0,
    minDepthMax: 0,
    minActivationsDepthMax: 0,
    budgetPercent: 25,
    budgetCapTokens: 0,
    contextWindowTokens: 8192,
    includeNames: true,
    recursive: false,
    overflowAlert: false,
    caseSensitive: false,
    matchWholeWords: false,
    useGroupScoring: false,
    insertionStrategy: 1,
    characterStrategy: 1,
    maxRecursionSteps: 0,
    meta: null,
  };
}
