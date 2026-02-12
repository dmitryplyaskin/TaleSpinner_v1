import { applyInclusionGroups, type GroupCandidate } from "./world-info-groups";
import { matchEntryAgainstText } from "./world-info-matcher";
import { isEntryDelayed } from "./world-info-timed-effects";

import type {
  PreparedWorldInfoEntry,
  WorldInfoResolveDebug,
  WorldInfoRuntimeTrigger,
  WorldInfoSettingsDto,
} from "./world-info-types";

type ScanState = "INITIAL" | "RECURSION" | "MIN_ACTIVATIONS";

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function resolveBudgetLimit(settings: WorldInfoSettingsDto): number {
  const base = Math.max(1, Math.round((settings.budgetPercent * settings.contextWindowTokens) / 100));
  if (settings.budgetCapTokens > 0) return Math.min(base, settings.budgetCapTokens);
  return base;
}

function resolveDelayUntilRecursionLevel(entry: PreparedWorldInfoEntry): number {
  if (entry.delayUntilRecursion === true) return 1;
  if (entry.delayUntilRecursion === false) return 0;
  if (typeof entry.delayUntilRecursion === "number" && Number.isFinite(entry.delayUntilRecursion)) {
    return Math.max(0, Math.floor(entry.delayUntilRecursion));
  }
  return 0;
}

function charFilterMismatch(params: {
  entry: PreparedWorldInfoEntry;
  charName: string;
  charTags: string[];
}): boolean {
  const filter = params.entry.characterFilter;
  if (!filter.names.length && !filter.tags.length) return false;
  const lowerName = params.charName.toLowerCase();
  const lowerTags = params.charTags.map((item) => item.toLowerCase());
  const byName = filter.names.some((item) => item.toLowerCase() === lowerName);
  const byTag = filter.tags.some((tag) => lowerTags.includes(tag.toLowerCase()));
  const matched = byName || byTag;
  return filter.isExclude ? matched : !matched;
}

function sortEntriesForScan(entries: PreparedWorldInfoEntry[]): PreparedWorldInfoEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.order !== b.order) return b.order - a.order;
    return a.uid - b.uid;
  });
}

function buildHistoryText(history: Array<{ role: string; content: string }>, scanDepth: number): string {
  const depth = Math.max(0, scanDepth);
  if (depth === 0) return "";
  const slice = history.slice(Math.max(0, history.length - depth));
  return slice.map((item) => item.content).join("\n");
}

function buildEntryScanText(params: {
  entry: PreparedWorldInfoEntry;
  history: Array<{ role: string; content: string }>;
  settings: WorldInfoSettingsDto;
  fallbackScanDepth: number;
  recursionBuffer: string;
  scanState: ScanState;
  personaDescription: string;
  characterDescription: string;
  characterPersonality: string;
  characterDepthPrompt: string;
  scenario: string;
  creatorNotes: string;
}): string {
  const scanDepth = params.entry.scanDepth ?? params.fallbackScanDepth;
  const chunks: string[] = [buildHistoryText(params.history, scanDepth)];

  if (params.entry.matchPersonaDescription && params.personaDescription) {
    chunks.push(params.personaDescription);
  }
  if (params.entry.matchCharacterDescription && params.characterDescription) {
    chunks.push(params.characterDescription);
  }
  if (params.entry.matchCharacterPersonality && params.characterPersonality) {
    chunks.push(params.characterPersonality);
  }
  if (params.entry.matchCharacterDepthPrompt && params.characterDepthPrompt) {
    chunks.push(params.characterDepthPrompt);
  }
  if (params.entry.matchScenario && params.scenario) {
    chunks.push(params.scenario);
  }
  if (params.entry.matchCreatorNotes && params.creatorNotes) {
    chunks.push(params.creatorNotes);
  }
  if (params.scanState !== "MIN_ACTIVATIONS" && params.recursionBuffer.trim()) {
    chunks.push(params.recursionBuffer);
  }

  return chunks.filter(Boolean).join("\n");
}

export type WorldInfoScanInput = {
  entries: PreparedWorldInfoEntry[];
  settings: WorldInfoSettingsDto;
  trigger: WorldInfoRuntimeTrigger;
  history: Array<{ role: string; content: string }>;
  messageIndex: number;
  scanSeed: string;
  dryRun: boolean;
  activeStickyHashes: Set<string>;
  activeCooldownHashes: Set<string>;
  personaDescription: string;
  characterDescription: string;
  characterPersonality: string;
  characterDepthPrompt: string;
  scenario: string;
  creatorNotes: string;
  charName: string;
  charTags: string[];
};

export type WorldInfoScanOutput = {
  activatedEntries: PreparedWorldInfoEntry[];
  debug: WorldInfoResolveDebug;
};

export function scanWorldInfoEntries(params: WorldInfoScanInput): WorldInfoScanOutput {
  const debug: WorldInfoResolveDebug = {
    warnings: [],
    matchedKeys: {},
    skips: [],
    budget: {
      limit: resolveBudgetLimit(params.settings),
      used: 0,
      overflowed: false,
    },
  };

  const sortedEntries = sortEntriesForScan(params.entries);
  const activatedMap = new Map<string, PreparedWorldInfoEntry>();
  const failedProbability = new Set<string>();
  const activatedGroups = new Set<string>();
  let recursionLevel = 0;
  let scanState: ScanState = "INITIAL";
  let minActivationDepth = params.settings.scanDepth;
  let recursionBuffer = "";

  const budgetLimit = debug.budget.limit;
  const hardLoopLimit = 64;
  let loopCount = 0;

  while (loopCount < hardLoopLimit) {
    loopCount += 1;
    const candidates: GroupCandidate[] = [];

    for (const entry of sortedEntries) {
      const stickyActive = params.activeStickyHashes.has(entry.hash);
      const cooldownActive = params.activeCooldownHashes.has(entry.hash);

      if (failedProbability.has(entry.hash)) {
        debug.skips.push({ hash: entry.hash, reason: "probability_failed_prior_loop" });
        continue;
      }
      if (activatedMap.has(entry.hash)) {
        debug.skips.push({ hash: entry.hash, reason: "already_activated" });
        continue;
      }
      if (entry.disable) {
        debug.skips.push({ hash: entry.hash, reason: "entry_disabled" });
        continue;
      }
      if (entry.triggers.length > 0 && !entry.triggers.includes(params.trigger)) {
        debug.skips.push({ hash: entry.hash, reason: "trigger_mismatch" });
        continue;
      }
      if (charFilterMismatch({ entry, charName: params.charName, charTags: params.charTags })) {
        debug.skips.push({ hash: entry.hash, reason: "character_filter_mismatch" });
        continue;
      }
      if (isEntryDelayed(entry, params.messageIndex)) {
        debug.skips.push({ hash: entry.hash, reason: "delay_skip" });
        continue;
      }
      if (cooldownActive && !stickyActive) {
        debug.skips.push({ hash: entry.hash, reason: "cooldown_skip" });
        continue;
      }

      const recursionLevelNeed = resolveDelayUntilRecursionLevel(entry);
      if (scanState === "INITIAL" && recursionLevelNeed > 0 && !stickyActive) {
        debug.skips.push({ hash: entry.hash, reason: "delay_until_recursion" });
        continue;
      }
      if (scanState === "RECURSION" && recursionLevel < recursionLevelNeed && !stickyActive) {
        debug.skips.push({ hash: entry.hash, reason: "recursion_level_skip" });
        continue;
      }
      if (scanState === "RECURSION" && entry.excludeRecursion && !stickyActive) {
        debug.skips.push({ hash: entry.hash, reason: "exclude_recursion" });
        continue;
      }

      let matched = false;
      let score = 0;
      let matchedKeys: string[] = [];

      if (entry.decorators.activate) {
        matched = true;
      } else if (entry.decorators.dontActivate) {
        debug.skips.push({ hash: entry.hash, reason: "decorator_dont_activate" });
        continue;
      } else if (entry.constant || stickyActive) {
        matched = true;
      } else if (entry.key.length === 0) {
        debug.skips.push({ hash: entry.hash, reason: "no_primary_keys" });
        continue;
      } else {
        const scanText = buildEntryScanText({
          entry,
          history: params.history,
          settings: params.settings,
          fallbackScanDepth: minActivationDepth,
          recursionBuffer,
          scanState,
          personaDescription: params.personaDescription,
          characterDescription: params.characterDescription,
          characterPersonality: params.characterPersonality,
          characterDepthPrompt: params.characterDepthPrompt,
          scenario: params.scenario,
          creatorNotes: params.creatorNotes,
        });
        const matchResult = matchEntryAgainstText({
          entry,
          text: scanText,
          settings: params.settings,
        });
        matched = matchResult.matched;
        matchedKeys = [...matchResult.primaryMatched, ...matchResult.secondaryMatched];
        score = matchedKeys.length;
      }

      if (!matched) {
        debug.skips.push({ hash: entry.hash, reason: "key_match_failed" });
        continue;
      }

      if (matchedKeys.length > 0) {
        debug.matchedKeys[entry.hash] = matchedKeys;
      }

      candidates.push({
        entry,
        score,
        stickyActive,
        cooldownActive,
        delayed: isEntryDelayed(entry, params.messageIndex),
      });
    }

    candidates.sort((a, b) => {
      if (a.stickyActive !== b.stickyActive) return a.stickyActive ? -1 : 1;
      if (a.entry.order !== b.entry.order) return b.entry.order - a.entry.order;
      return a.entry.uid - b.entry.uid;
    });

    const grouped = applyInclusionGroups({
      candidates,
      settings: params.settings,
      scanSeed: `${params.scanSeed}:${loopCount}`,
      alreadyActivatedGroups: activatedGroups,
    });

    grouped.activatedGroups.forEach((item) => activatedGroups.add(item));

    const activatedThisLoop: PreparedWorldInfoEntry[] = [];
    let recursionAllowedHit = false;

    for (const candidate of grouped.selected) {
      const entry = candidate.entry;
      if (entry.useProbability && entry.probability < 100 && !candidate.stickyActive) {
        const roll = Math.random() * 100;
        if (roll > entry.probability) {
          failedProbability.add(entry.hash);
          debug.skips.push({ hash: entry.hash, reason: "probability_failed" });
          continue;
        }
      }

      const tokens = estimateTokens(entry.content);
      if (!entry.ignoreBudget && debug.budget.used + tokens > budgetLimit) {
        debug.budget.overflowed = true;
        debug.skips.push({ hash: entry.hash, reason: "budget_overflow" });
        continue;
      }

      debug.budget.used += tokens;
      if (!activatedMap.has(entry.hash)) {
        activatedMap.set(entry.hash, entry);
        activatedThisLoop.push(entry);
      }
      if (!entry.preventRecursion) recursionAllowedHit = true;
    }

    if (activatedThisLoop.length > 0) {
      const chunk = activatedThisLoop.map((item) => item.content).join("\n");
      recursionBuffer = recursionBuffer ? `${recursionBuffer}\n${chunk}` : chunk;
    }

    const maxRecursionReached =
      params.settings.maxRecursionSteps > 0 && recursionLevel >= params.settings.maxRecursionSteps;
    const shouldRecurse =
      params.settings.recursive &&
      recursionAllowedHit &&
      !maxRecursionReached &&
      (scanState === "INITIAL" ||
        scanState === "RECURSION" ||
        (scanState === "MIN_ACTIVATIONS" && recursionBuffer.trim().length > 0));

    if (shouldRecurse) {
      scanState = "RECURSION";
      recursionLevel += 1;
      continue;
    }

    if (activatedMap.size < params.settings.minActivations) {
      const maxDepthByMinActivations =
        params.settings.minDepthMax ?? params.settings.minActivationsDepthMax;
      const canIncreaseDepth =
        maxDepthByMinActivations <= 0 || minActivationDepth < maxDepthByMinActivations;
      if (canIncreaseDepth && minActivationDepth < params.history.length) {
        minActivationDepth += 1;
        scanState = "MIN_ACTIVATIONS";
        continue;
      }
    }

    break;
  }

  if (loopCount >= hardLoopLimit) {
    debug.warnings.push("scan loop stopped by hard limit");
  }

  return {
    activatedEntries: Array.from(activatedMap.values()),
    debug,
  };
}
