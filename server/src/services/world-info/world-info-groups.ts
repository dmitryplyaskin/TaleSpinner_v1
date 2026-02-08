import { createHash } from "crypto";

import type { PreparedWorldInfoEntry, WorldInfoSettingsDto } from "./world-info-types";

export type GroupCandidate = {
  entry: PreparedWorldInfoEntry;
  score: number;
  stickyActive: boolean;
  cooldownActive: boolean;
  delayed: boolean;
};

function splitGroups(group: string): string[] {
  return group
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashToUnitInterval(seed: string): number {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  const value = Number.parseInt(hex, 16);
  const max = 0xffffffffffff;
  return Math.max(0, Math.min(1, value / max));
}

function pickWeightedCandidate(candidates: GroupCandidate[], seed: string): GroupCandidate {
  const totalWeight = candidates.reduce((acc, item) => acc + Math.max(0, item.entry.groupWeight), 0);
  if (totalWeight <= 0) return candidates[0];
  const r = hashToUnitInterval(seed) * totalWeight;
  let sum = 0;
  for (const candidate of candidates) {
    sum += Math.max(0, candidate.entry.groupWeight);
    if (r <= sum) return candidate;
  }
  return candidates[candidates.length - 1];
}

export function applyInclusionGroups(params: {
  candidates: GroupCandidate[];
  settings: WorldInfoSettingsDto;
  scanSeed: string;
  alreadyActivatedGroups: Set<string>;
}): { selected: GroupCandidate[]; activatedGroups: Set<string> } {
  const selected: GroupCandidate[] = [];
  const selectedHashes = new Set<string>();
  const byGroup = new Map<string, GroupCandidate[]>();

  for (const candidate of params.candidates) {
    const groups = splitGroups(candidate.entry.group);
    if (groups.length === 0) {
      selected.push(candidate);
      selectedHashes.add(candidate.entry.hash);
      continue;
    }
    for (const group of groups) {
      const list = byGroup.get(group);
      if (list) list.push(candidate);
      else byGroup.set(group, [candidate]);
    }
  }

  const activatedGroups = new Set(params.alreadyActivatedGroups);

  for (const [groupName, groupCandidates] of byGroup.entries()) {
    if (activatedGroups.has(groupName)) continue;
    if (groupCandidates.length === 0) continue;

    let active = groupCandidates.slice();
    const stickyCandidates = active.filter((item) => item.stickyActive);
    if (stickyCandidates.length > 0) {
      active = stickyCandidates;
    } else {
      active = active.filter((item) => !item.cooldownActive && !item.delayed);
      if (active.length === 0) continue;
    }

    const scoringEnabled =
      params.settings.useGroupScoring || active.some((item) => item.entry.useGroupScoring === true);
    if (scoringEnabled) {
      const maxScore = Math.max(...active.map((item) => item.score));
      active = active.filter((item) => item.score === maxScore);
    }

    const overrides = active.filter((item) => item.entry.groupOverride);
    if (overrides.length > 0) {
      overrides.sort((a, b) => b.entry.order - a.entry.order);
      const winner = overrides[0];
      if (!selectedHashes.has(winner.entry.hash)) {
        selected.push(winner);
        selectedHashes.add(winner.entry.hash);
      }
      activatedGroups.add(groupName);
      continue;
    }

    const winner = pickWeightedCandidate(active, `${params.scanSeed}:${groupName}`);
    if (winner && !selectedHashes.has(winner.entry.hash)) {
      selected.push(winner);
      selectedHashes.add(winner.entry.hash);
    }
    activatedGroups.add(groupName);
  }

  return { selected, activatedGroups };
}
