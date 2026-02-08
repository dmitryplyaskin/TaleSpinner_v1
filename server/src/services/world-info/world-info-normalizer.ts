import { createHash } from "crypto";

import {
  DEFAULT_WORLD_INFO_BOOK_DATA,
  DEFAULT_WORLD_INFO_CHARACTER_FILTER,
  DEFAULT_WORLD_INFO_ENTRY,
} from "./world-info-defaults";
import type { WorldInfoBookData, WorldInfoEntry } from "./world-info-types";

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

export function normalizeCharacterFilter(input: unknown) {
  if (!isRecord(input)) return { ...DEFAULT_WORLD_INFO_CHARACTER_FILTER };
  return {
    isExclude: asBoolean(input.isExclude, false),
    names: asStringArray(input.names),
    tags: asStringArray(input.tags),
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
    selectiveLogic: asNumber(
      src.selectiveLogic,
      DEFAULT_WORLD_INFO_ENTRY.selectiveLogic
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
    probability: Math.max(0, Math.min(100, asNumber(src.probability, 100))),
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
    triggers: asStringArray(src.triggers),
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
