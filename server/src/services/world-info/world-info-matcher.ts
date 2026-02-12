import type { PreparedWorldInfoEntry, WorldInfoSettingsDto } from "./world-info-types";

type MatcherOptions = {
  caseSensitive: boolean;
  wholeWords: boolean;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRegexKey(input: string): RegExp | null {
  if (!input.startsWith("/") || input.length < 2) return null;
  const lastSlash = input.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  const pattern = input.slice(1, lastSlash);
  const flags = input.slice(lastSlash + 1);
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function matchTextByKey(text: string, key: string, opts: MatcherOptions): boolean {
  const regex = parseRegexKey(key);
  if (regex) return regex.test(text);

  const source = opts.caseSensitive ? text : text.toLowerCase();
  const needleRaw = opts.caseSensitive ? key : key.toLowerCase();
  if (!needleRaw.trim()) return false;

  if (!opts.wholeWords) return source.includes(needleRaw);
  if (/\s/.test(needleRaw)) return source.includes(needleRaw);

  const pattern = new RegExp(`(?:^|\\W)(${escapeRegex(needleRaw)})(?:$|\\W)`, opts.caseSensitive ? "" : "i");
  return pattern.test(source);
}

export function resolveEntryMatcherOptions(params: {
  entry: PreparedWorldInfoEntry;
  settings: WorldInfoSettingsDto;
}): MatcherOptions {
  return {
    caseSensitive:
      typeof params.entry.caseSensitive === "boolean"
        ? params.entry.caseSensitive
        : params.settings.caseSensitive,
    wholeWords:
      typeof params.entry.matchWholeWords === "boolean"
        ? params.entry.matchWholeWords
        : params.settings.matchWholeWords,
  };
}

export function countMatchedKeys(params: {
  text: string;
  keys: string[];
  options: MatcherOptions;
}): { matched: string[]; failed: string[] } {
  const matched: string[] = [];
  const failed: string[] = [];
  for (const key of params.keys) {
    if (matchTextByKey(params.text, key, params.options)) {
      matched.push(key);
    } else {
      failed.push(key);
    }
  }
  return { matched, failed };
}

export function evaluateSecondaryLogic(params: {
  matchedSecondary: string[];
  totalSecondary: number;
  logic: PreparedWorldInfoEntry["selectiveLogic"];
}): boolean {
  const matched = params.matchedSecondary.length;
  const total = params.totalSecondary;
  if (total === 0) return true;

  switch (params.logic) {
    case 3: // AND_ALL
      return matched === total;
    case 1: // NOT_ALL
      return matched < total;
    case 2: // NOT_ANY
      return matched === 0;
    case 0: // AND_ANY
    default:
      return matched > 0;
  }
}

export function matchEntryAgainstText(params: {
  entry: PreparedWorldInfoEntry;
  text: string;
  settings: WorldInfoSettingsDto;
}): { matched: boolean; primaryMatched: string[]; secondaryMatched: string[] } {
  const options = resolveEntryMatcherOptions({ entry: params.entry, settings: params.settings });
  const primary = countMatchedKeys({
    text: params.text,
    keys: params.entry.key,
    options,
  });
  if (primary.matched.length === 0) {
    return { matched: false, primaryMatched: [], secondaryMatched: [] };
  }

  const secondary = countMatchedKeys({
    text: params.text,
    keys: params.entry.keysecondary,
    options,
  });
  if (!params.entry.selective) {
    return {
      matched: true,
      primaryMatched: primary.matched,
      secondaryMatched: secondary.matched,
    };
  }

  const secondaryOk = evaluateSecondaryLogic({
    matchedSecondary: secondary.matched,
    totalSecondary: params.entry.keysecondary.length,
    logic: params.entry.selectiveLogic,
  });

  return {
    matched: secondaryOk,
    primaryMatched: primary.matched,
    secondaryMatched: secondary.matched,
  };
}
