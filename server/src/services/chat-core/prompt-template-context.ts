import { listProjectedPromptMessages } from "../chat-entry-parts/prompt-history";

import { getChatById } from "./chats-repository";
import { getEntityProfileById } from "./entity-profiles-repository";
import { getSelectedUserPerson } from "./user-persons-repository";

import type { PromptTemplateRenderContext } from "./prompt-template-renderer";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function defineToString(obj: Record<string, unknown>, toStringValue: string): void {
  // LiquidJS stringifies non-primitive values via String(value),
  // so a custom toString enables `{{char}}` / `{{user}}` while still allowing `{{char.name}}`.
  Object.defineProperty(obj, "toString", {
    value: () => toStringValue,
    enumerable: false,
    configurable: true,
  });
}

function asString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function enrichTemplateContext(
  base: PromptTemplateRenderContext,
  worldInfo?: {
    anchorBefore?: string;
    anchorAfter?: string;
    wiBefore?: string;
    wiAfter?: string;
    loreBefore?: string;
    loreAfter?: string;
  }
): PromptTemplateRenderContext {
  const charObj = isRecord(base.char) ? base.char : {};
  const userObj = isRecord(base.user) ? base.user : {};

  // Make `{{char}}` and `{{user}}` behave like SillyTavern macros (name strings),
  // without breaking existing templates that expect `{{char.name}}` / `{{user.name}}`.
  const charName = asString(charObj.name).trim();
  if (charName) defineToString(charObj, charName);

  const userName = asString(userObj.name).trim();
  if (userName) defineToString(userObj, userName);

  // SillyTavern-style top-level aliases (best-effort).
  // Many of these are used by ST "Story String" templates.
  base.description = asString(charObj.description);
  base.scenario = asString(charObj.scenario);
  base.personality = asString(charObj.personality);
  base.system = asString(charObj.system_prompt);

  // We don't have a 1:1 "persona description" field yet; `prefix` is the closest concept.
  base.persona = asString(userObj.prefix);

  base.anchorBefore = worldInfo?.anchorBefore ?? "";
  base.anchorAfter = worldInfo?.anchorAfter ?? "";
  base.wiBefore = worldInfo?.wiBefore ?? "";
  base.wiAfter = worldInfo?.wiAfter ?? "";
  base.loreBefore = worldInfo?.loreBefore ?? "";
  base.loreAfter = worldInfo?.loreAfter ?? "";

  // Example messages: we store CC field as `mes_example`.
  base.mesExamplesRaw = asString(charObj.mes_example);
  base.mesExamples = base.mesExamplesRaw;

  base.char = charObj;
  base.user = userObj;
  return base;
}

export async function buildPromptTemplateRenderContext(params: {
  ownerId?: string;
  chatId?: string;
  branchId?: string;
  entityProfileId?: string;
  historyLimit?: number;
  excludeMessageIds?: string[];
  excludeEntryIds?: string[];
  worldInfo?: {
    anchorBefore?: string;
    anchorAfter?: string;
    wiBefore?: string;
    wiAfter?: string;
    loreBefore?: string;
    loreAfter?: string;
  };
}): Promise<PromptTemplateRenderContext> {
  const ownerId = params.ownerId ?? "global";

  // Default “empty” context: should never break Liquid rendering.
  const base: PromptTemplateRenderContext = {
    char: {},
    user: {},
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date().toISOString(),
  };

  const [selectedUser] = await Promise.all([
    getSelectedUserPerson({ ownerId }),
  ]);

  base.user = selectedUser ?? {};

  if (!params.chatId) {
    if (params.entityProfileId) {
      const entityProfile = await getEntityProfileById(params.entityProfileId);
      base.char = entityProfile?.spec ?? {};
    }
    return enrichTemplateContext(base, params.worldInfo);
  }

  const chat = await getChatById(params.chatId);
  const branchId = params.branchId ?? chat?.activeBranchId ?? null;
  const entityProfileId = params.entityProfileId ?? chat?.entityProfileId ?? null;

  // If chat exists but branch is not resolved (shouldn't happen in v1), keep empty history.
  let history: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (branchId && params.chatId) {
    try {
      const projected = await listProjectedPromptMessages({
        chatId: params.chatId,
        branchId,
        limit: params.historyLimit ?? 50,
        excludeEntryIds: params.excludeEntryIds,
      });
      history = projected.messages.map((m) => ({ role: m.role, content: m.content }));
    } catch {
      history = [];
    }
  }

  const entityProfile = entityProfileId
    ? await getEntityProfileById(entityProfileId)
    : null;

  return enrichTemplateContext({
    char: entityProfile?.spec ?? {},
    user: selectedUser ?? {},
    chat: {
      id: chat?.id ?? params.chatId,
      title: chat?.title ?? "",
      branchId: branchId ?? params.branchId ?? null,
      createdAt: chat?.createdAt ?? null,
      updatedAt: chat?.updatedAt ?? null,
    },
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    rag: {},
    art: {},
    now: new Date().toISOString(),
  }, params.worldInfo);
}

