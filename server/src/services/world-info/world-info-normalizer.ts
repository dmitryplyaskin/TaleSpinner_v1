import { createHash } from "crypto";

import {
  DEFAULT_WORLD_INFO_BOOK_DATA,
  DEFAULT_WORLD_INFO_CHARACTER_FILTER,
  DEFAULT_WORLD_INFO_ENTRY,
} from "./world-info-defaults";
import {
  worldInfoGenerationTriggers,
  type WorldInfoBookData,
  type WorldInfoEntry,
  type WorldInfoGenerationTrigger,
  type WorldInfoInsertionStrategy,
  type WorldInfoSettingsDto,
} from "./world-info-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const WORLD_INFO_TRIGGER_SET = new Set<WorldInfoGenerationTrigger>(worldInfoGenerationTriggers);
const LEGACY_TRIGGER_MAP: Record<string, WorldInfoGenerationTrigger> = {
  generate: "normal",
  normal: "normal",
  continue: "continue",
  continue_generate: "continue",
  continue_generation: "continue",
  impersonate: "impersonate",
  swipe: "swipe",
  regenerate: "regenerate",
  quiet: "quiet",
};

function normalizeWorldInfoTrigger(value: unknown): WorldInfoGenerationTrigger | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (WORLD_INFO_TRIGGER_SET.has(normalized as WorldInfoGenerationTrigger)) {
    return normalized as WorldInfoGenerationTrigger;
  }
  return LEGACY_TRIGGER_MAP[normalized] ?? null;
}

function normalizeWorldInfoTriggers(input: unknown): WorldInfoGenerationTrigger[] {
  if (!Array.isArray(input)) return [];
  const deduped = new Set<WorldInfoGenerationTrigger>();
  for (const raw of input) {
    const normalized = normalizeWorldInfoTrigger(raw);
    if (normalized) deduped.add(normalized);
  }
  return Array.from(deduped);
}

function clampInclusive(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCharacterFilter(input: unknown) {
  if (!isRecord(input)) return { ...DEFAULT_WORLD_INFO_CHARACTER_FILTER };
  return {
    isExclude: asBoolean(input.isExclude, false),
    names: asStringArray(input.names),
    tags: asStringArray(input.tags),
  };
}

export type WorldInfoSettingsPatchInput = Partial<
  Omit<WorldInfoSettingsDto, "ownerId" | "createdAt" | "updatedAt">
> & {
  minDepthMax?: unknown;
  minActivationsDepthMax?: unknown;
  insertionStrategy?: unknown;
  characterStrategy?: unknown;
};

function asInsertionStrategy(
  value: unknown,
  fallback: WorldInfoInsertionStrategy
): WorldInfoInsertionStrategy {
  const num = asNumber(value, fallback);
  if (num === 0 || num === 1 || num === 2) return num;
  return fallback;
}

export function normalizeWorldInfoSettingsPatch(params: {
  patch: WorldInfoSettingsPatchInput;
  current: Pick<
    WorldInfoSettingsDto,
    | "scanDepth"
    | "minActivations"
    | "minDepthMax"
    | "minActivationsDepthMax"
    | "budgetPercent"
    | "budgetCapTokens"
    | "contextWindowTokens"
    | "includeNames"
    | "recursive"
    | "overflowAlert"
    | "caseSensitive"
    | "matchWholeWords"
    | "useGroupScoring"
    | "insertionStrategy"
    | "characterStrategy"
    | "maxRecursionSteps"
    | "meta"
  >;
}): Omit<WorldInfoSettingsDto, "ownerId" | "createdAt" | "updatedAt"> {
  const patch = params.patch;
  const current = params.current;

  const minDepthMaxInput =
    typeof patch.minDepthMax === "number" && Number.isFinite(patch.minDepthMax)
      ? patch.minDepthMax
      : typeof patch.minActivationsDepthMax === "number" &&
          Number.isFinite(patch.minActivationsDepthMax)
        ? patch.minActivationsDepthMax
        : current.minDepthMax;
  const insertionStrategyInput =
    typeof patch.insertionStrategy === "number" && Number.isFinite(patch.insertionStrategy)
      ? patch.insertionStrategy
      : typeof patch.characterStrategy === "number" && Number.isFinite(patch.characterStrategy)
        ? patch.characterStrategy
        : current.insertionStrategy;

  let minActivations = Math.max(
    0,
    Math.floor(
      typeof patch.minActivations === "number" && Number.isFinite(patch.minActivations)
        ? patch.minActivations
        : current.minActivations
    )
  );
  let maxRecursionSteps = Math.max(
    0,
    Math.floor(
      typeof patch.maxRecursionSteps === "number" && Number.isFinite(patch.maxRecursionSteps)
        ? patch.maxRecursionSteps
        : current.maxRecursionSteps
    )
  );

  if (minActivations > 0) {
    maxRecursionSteps = 0;
  } else if (maxRecursionSteps > 0) {
    minActivations = 0;
  }

  const minDepthMax = Math.max(0, Math.floor(minDepthMaxInput));
  const insertionStrategy = asInsertionStrategy(
    insertionStrategyInput,
    current.insertionStrategy
  );

  return {
    scanDepth: Math.max(
      0,
      Math.floor(
        typeof patch.scanDepth === "number" && Number.isFinite(patch.scanDepth)
          ? patch.scanDepth
          : current.scanDepth
      )
    ),
    minActivations,
    minDepthMax,
    minActivationsDepthMax: minDepthMax,
    budgetPercent: clampInclusive(
      Math.floor(
        typeof patch.budgetPercent === "number" && Number.isFinite(patch.budgetPercent)
          ? patch.budgetPercent
          : current.budgetPercent
      ),
      1,
      100
    ),
    budgetCapTokens: Math.max(
      0,
      Math.floor(
        typeof patch.budgetCapTokens === "number" && Number.isFinite(patch.budgetCapTokens)
          ? patch.budgetCapTokens
          : current.budgetCapTokens
      )
    ),
    contextWindowTokens: Math.max(
      1,
      Math.floor(
        typeof patch.contextWindowTokens === "number" &&
          Number.isFinite(patch.contextWindowTokens)
          ? patch.contextWindowTokens
          : current.contextWindowTokens
      )
    ),
    includeNames: asBoolean(patch.includeNames, current.includeNames),
    recursive: asBoolean(patch.recursive, current.recursive),
    overflowAlert: asBoolean(patch.overflowAlert, current.overflowAlert),
    caseSensitive: asBoolean(patch.caseSensitive, current.caseSensitive),
    matchWholeWords: asBoolean(patch.matchWholeWords, current.matchWholeWords),
    useGroupScoring: asBoolean(patch.useGroupScoring, current.useGroupScoring),
    insertionStrategy,
    characterStrategy: insertionStrategy,
    maxRecursionSteps,
    meta:
      typeof patch.meta === "undefined"
        ? current.meta
        : isRecord(patch.meta) || patch.meta === null
          ? patch.meta
          : current.meta,
  };
}

export function normalizeWorldInfoEntry(input: unknown, fallbackUid: number): WorldInfoEntry {
  const src = isRecord(input) ? input : {};

  const uidValue =
    typeof src.uid === "number" && Number.isFinite(src.uid)
      ? Math.max(0, Math.floor(src.uid))
      : fallbackUid;

  const delayUntilRecursionRaw = src.delayUntilRecursion;
  let delayUntilRecursion: number | boolean = 0;
  if (typeof delayUntilRecursionRaw === "boolean") {
    delayUntilRecursion = delayUntilRecursionRaw;
  } else if (
    typeof delayUntilRecursionRaw === "number" &&
    Number.isFinite(delayUntilRecursionRaw)
  ) {
    delayUntilRecursion = Math.max(0, Math.floor(delayUntilRecursionRaw));
  }

  return {
    uid: uidValue,
    key: asStringArray(src.key),
    keysecondary: asStringArray(src.keysecondary),
    comment: asString(src.comment),
    content: asString(src.content),
    constant: asBoolean(src.constant, DEFAULT_WORLD_INFO_ENTRY.constant),
    vectorized: asBoolean(src.vectorized, DEFAULT_WORLD_INFO_ENTRY.vectorized),
    selective: asBoolean(src.selective, DEFAULT_WORLD_INFO_ENTRY.selective),
    selectiveLogic: clampInclusive(
      Math.floor(asNumber(src.selectiveLogic, DEFAULT_WORLD_INFO_ENTRY.selectiveLogic)),
      0,
      3
    ) as WorldInfoEntry["selectiveLogic"],
    addMemo: asBoolean(src.addMemo, DEFAULT_WORLD_INFO_ENTRY.addMemo),
    order: asNumber(src.order, DEFAULT_WORLD_INFO_ENTRY.order),
    position: asNumber(src.position, DEFAULT_WORLD_INFO_ENTRY.position) as WorldInfoEntry["position"],
    disable: asBoolean(src.disable, DEFAULT_WORLD_INFO_ENTRY.disable),
    ignoreBudget: asBoolean(src.ignoreBudget, DEFAULT_WORLD_INFO_ENTRY.ignoreBudget),
    excludeRecursion: asBoolean(
      src.excludeRecursion,
      DEFAULT_WORLD_INFO_ENTRY.excludeRecursion
    ),
    preventRecursion: asBoolean(
      src.preventRecursion,
      DEFAULT_WORLD_INFO_ENTRY.preventRecursion
    ),
    matchPersonaDescription: asBoolean(
      src.matchPersonaDescription,
      DEFAULT_WORLD_INFO_ENTRY.matchPersonaDescription
    ),
    matchCharacterDescription: asBoolean(
      src.matchCharacterDescription,
      DEFAULT_WORLD_INFO_ENTRY.matchCharacterDescription
    ),
    matchCharacterPersonality: asBoolean(
      src.matchCharacterPersonality,
      DEFAULT_WORLD_INFO_ENTRY.matchCharacterPersonality
    ),
    matchCharacterDepthPrompt: asBoolean(
      src.matchCharacterDepthPrompt,
      DEFAULT_WORLD_INFO_ENTRY.matchCharacterDepthPrompt
    ),
    matchScenario: asBoolean(src.matchScenario, DEFAULT_WORLD_INFO_ENTRY.matchScenario),
    matchCreatorNotes: asBoolean(
      src.matchCreatorNotes,
      DEFAULT_WORLD_INFO_ENTRY.matchCreatorNotes
    ),
    delayUntilRecursion,
    probability: clampInclusive(asNumber(src.probability, 100), 0, 100),
    useProbability: asBoolean(src.useProbability, DEFAULT_WORLD_INFO_ENTRY.useProbability),
    depth: Math.max(0, asNumber(src.depth, DEFAULT_WORLD_INFO_ENTRY.depth)),
    outletName: asString(src.outletName),
    group: asString(src.group),
    groupOverride: asBoolean(src.groupOverride, DEFAULT_WORLD_INFO_ENTRY.groupOverride),
    groupWeight: Math.max(0, asNumber(src.groupWeight, DEFAULT_WORLD_INFO_ENTRY.groupWeight)),
    scanDepth: asNullableNumber(src.scanDepth),
    caseSensitive:
      typeof src.caseSensitive === "boolean" ? src.caseSensitive : DEFAULT_WORLD_INFO_ENTRY.caseSensitive,
    matchWholeWords:
      typeof src.matchWholeWords === "boolean"
        ? src.matchWholeWords
        : DEFAULT_WORLD_INFO_ENTRY.matchWholeWords,
    useGroupScoring:
      typeof src.useGroupScoring === "boolean"
        ? src.useGroupScoring
        : DEFAULT_WORLD_INFO_ENTRY.useGroupScoring,
    automationId: asString(src.automationId),
    role: asNumber(src.role, DEFAULT_WORLD_INFO_ENTRY.role) as WorldInfoEntry["role"],
    sticky: asNullableNumber(src.sticky),
    cooldown: asNullableNumber(src.cooldown),
    delay: asNullableNumber(src.delay),
    triggers: normalizeWorldInfoTriggers(src.triggers),
    characterFilter: normalizeCharacterFilter(src.characterFilter),
    extensions: isRecord(src.extensions) ? src.extensions : {},
  };
}

export function normalizeWorldInfoBookData(input: unknown): WorldInfoBookData {
  if (!isRecord(input)) return { ...DEFAULT_WORLD_INFO_BOOK_DATA };
  const entries = isRecord(input.entries) ? input.entries : {};
  const extensions = isRecord(input.extensions) ? input.extensions : {};
  const name = typeof input.name === "string" ? input.name : undefined;
  return { name, entries, extensions };
}

export function normalizeWorldInfoBookEntries(data: WorldInfoBookData): Record<string, WorldInfoEntry> {
  const rawEntries = isRecord(data.entries) ? data.entries : {};
  const normalized: Record<string, WorldInfoEntry> = {};
  let nextUid = 0;
  for (const key of Object.keys(rawEntries)) {
    const entry = normalizeWorldInfoEntry(rawEntries[key], nextUid);
    normalized[key] = entry;
    nextUid = Math.max(nextUid, entry.uid + 1);
  }
  return normalized;
}

export function normalizeWorldInfoBookPayload(input: unknown): {
  data: WorldInfoBookData;
  entries: Record<string, WorldInfoEntry>;
} {
  const data = normalizeWorldInfoBookData(input);
  const entries = normalizeWorldInfoBookEntries(data);
  return { data: { ...data, entries }, entries };
}

export function slugifyWorldInfoName(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "world-info-book";
}

export function parseLeadingDecorators(content: string): {
  cleanContent: string;
  activate: boolean;
  dontActivate: boolean;
} {
  const lines = String(content ?? "").split(/\r?\n/);
  const kept: string[] = [];
  let activate = false;
  let dontActivate = false;
  let stillInHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (stillInHeader) {
      if (trimmed.startsWith("@@@")) {
        kept.push(line.replace("@@@", "@@"));
        stillInHeader = false;
        continue;
      }
      if (trimmed === "@@activate") {
        activate = true;
        continue;
      }
      if (trimmed === "@@dont_activate") {
        dontActivate = true;
        continue;
      }
      if (trimmed.startsWith("@@")) {
        continue;
      }
      stillInHeader = false;
    }
    kept.push(line);
  }

  return { cleanContent: kept.join("\n").trim(), activate, dontActivate };
}

export function buildWorldInfoEntryHash(params: {
  bookId: string;
  uid: number;
  normalizedEntry: WorldInfoEntry;
}): string {
  const payload = `${params.bookId}:${params.uid}:${JSON.stringify(params.normalizedEntry)}`;
  return createHash("sha256").update(payload).digest("hex");
}
