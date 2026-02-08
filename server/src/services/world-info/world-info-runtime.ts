import type { OperationTrigger } from "@shared/types/operation-profiles";

import { getChatById } from "../chat-core/chats-repository";
import { getEntityProfileById } from "../chat-core/entity-profiles-repository";
import { getSelectedUserPerson } from "../chat-core/user-persons-repository";
import { resolveActiveWorldInfoBooks } from "./world-info-bindings";
import {
  buildWorldInfoEntryHash,
  normalizeWorldInfoBookEntries,
  parseLeadingDecorators,
} from "./world-info-normalizer";
import { assembleWorldInfoPromptOutput } from "./world-info-prompt-assembly";
import {
  getBookDataEntries,
  getBranchMessageIndex,
  getWorldInfoSettings,
} from "./world-info-repositories";
import { scanWorldInfoEntries } from "./world-info-scanner";
import {
  applyTimedEffectsForActivatedEntries,
  loadTimedEffectsState,
} from "./world-info-timed-effects";
import type {
  PreparedWorldInfoEntry,
  WorldInfoResolveResult,
  WorldInfoRuntimeTrigger,
} from "./world-info-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapTrigger(trigger: OperationTrigger): WorldInfoRuntimeTrigger {
  return trigger === "regenerate" ? "regenerate" : "normal";
}

export async function resolveWorldInfoRuntime(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  trigger: OperationTrigger;
  history: Array<{ role: string; content: string }>;
  scanSeed: string;
  dryRun?: boolean;
}): Promise<WorldInfoResolveResult> {
  const dryRun = params.dryRun ?? false;
  const [settings, selectedUser, entityProfile] = await Promise.all([
    getWorldInfoSettings({ ownerId: params.ownerId }),
    getSelectedUserPerson({ ownerId: params.ownerId }),
    getEntityProfileById(params.entityProfileId),
  ]);

  const { orderedBooks } = await resolveActiveWorldInfoBooks({
    ownerId: params.ownerId,
    chatId: params.chatId,
    entityProfileId: params.entityProfileId,
    personaId: selectedUser?.id ?? null,
    settings,
  });

  const preparedEntries: PreparedWorldInfoEntry[] = [];
  const warnings: string[] = [];
  for (const book of orderedBooks) {
    const entriesRaw = getBookDataEntries(book);
    const normalizedEntries = normalizeWorldInfoBookEntries({
      ...book.data,
      entries: entriesRaw,
    });
    for (const key of Object.keys(normalizedEntries)) {
      const normalizedEntry = normalizedEntries[key];
      const decorators = parseLeadingDecorators(normalizedEntry.content);
      const entryWithStrippedContent = {
        ...normalizedEntry,
        content: decorators.cleanContent,
      };
      preparedEntries.push({
        ...entryWithStrippedContent,
        bookId: book.id,
        bookName: book.name,
        hash: buildWorldInfoEntryHash({
          bookId: book.id,
          uid: entryWithStrippedContent.uid,
          normalizedEntry: entryWithStrippedContent,
        }),
        decorators: {
          activate: decorators.activate,
          dontActivate: decorators.dontActivate,
        },
      });
    }
  }

  const messageIndex = await getBranchMessageIndex({
    chatId: params.chatId,
    branchId: params.branchId,
  });

  const entriesByHash = new Map(preparedEntries.map((entry) => [entry.hash, entry]));
  const timedState = await loadTimedEffectsState({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    messageIndex,
    entriesByHash,
    dryRun,
  });

  const charSpec = isRecord(entityProfile?.spec) ? entityProfile!.spec : {};
  const charExtensions = isRecord(charSpec.extensions) ? charSpec.extensions : {};
  const creatorNotes =
    toString((charSpec as { creator_notes?: unknown }).creator_notes) ||
    toString((charSpec as { creatorcomment?: unknown }).creatorcomment);
  const characterDepthPrompt =
    toString((charSpec as { system_prompt?: unknown }).system_prompt) ||
    toString((charExtensions as { depth_prompt?: unknown }).depth_prompt);
  const charTags = asStringArray((charSpec as { tags?: unknown }).tags);

  const scanned = scanWorldInfoEntries({
    entries: preparedEntries,
    settings,
    trigger: mapTrigger(params.trigger),
    history: params.history,
    messageIndex,
    scanSeed: params.scanSeed,
    dryRun,
    activeStickyHashes: timedState.activeSticky,
    activeCooldownHashes: timedState.activeCooldown,
    personaDescription: toString(selectedUser?.prefix),
    characterDescription: toString((charSpec as { description?: unknown }).description),
    characterPersonality: toString((charSpec as { personality?: unknown }).personality),
    characterDepthPrompt,
    scenario: toString((charSpec as { scenario?: unknown }).scenario),
    creatorNotes,
    charName: toString((charSpec as { name?: unknown }).name),
    charTags,
  });

  const promptOutput = assembleWorldInfoPromptOutput({
    activatedEntries: scanned.activatedEntries,
    settings,
  });

  await applyTimedEffectsForActivatedEntries({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    messageIndex,
    activatedEntries: scanned.activatedEntries,
    dryRun,
  });

  return {
    ...promptOutput,
    activatedEntries: scanned.activatedEntries,
    debug: {
      ...scanned.debug,
      warnings: [...scanned.debug.warnings, ...timedState.warnings, ...warnings],
    },
  };
}

export async function resolveWorldInfoRuntimeForChat(params: {
  ownerId: string;
  chatId: string;
  branchId?: string;
  entityProfileId?: string;
  trigger: OperationTrigger;
  history: Array<{ role: string; content: string }>;
  scanSeed: string;
  dryRun?: boolean;
}): Promise<WorldInfoResolveResult> {
  const chat = await getChatById(params.chatId);
  const branchId = params.branchId ?? chat?.activeBranchId ?? null;
  if (!chat) {
    return {
      worldInfoBefore: "",
      worldInfoAfter: "",
      depthEntries: [],
      outletEntries: {},
      anTop: [],
      anBottom: [],
      emTop: [],
      emBottom: [],
      activatedEntries: [],
      debug: {
        warnings: ["chat_not_found"],
        matchedKeys: {},
        skips: [],
        budget: {
          limit: 1,
          used: 0,
          overflowed: false,
        },
      },
    };
  }
  if (!branchId) {
    return {
      worldInfoBefore: "",
      worldInfoAfter: "",
      depthEntries: [],
      outletEntries: {},
      anTop: [],
      anBottom: [],
      emTop: [],
      emBottom: [],
      activatedEntries: [],
      debug: {
        warnings: ["branch_not_found"],
        matchedKeys: {},
        skips: [],
        budget: {
          limit: 1,
          used: 0,
          overflowed: false,
        },
      },
    };
  }

  return resolveWorldInfoRuntime({
    ownerId: params.ownerId,
    chatId: chat.id,
    branchId,
    entityProfileId: params.entityProfileId ?? chat.entityProfileId,
    trigger: params.trigger,
    history: params.history,
    scanSeed: params.scanSeed,
    dryRun: params.dryRun,
  });
}
