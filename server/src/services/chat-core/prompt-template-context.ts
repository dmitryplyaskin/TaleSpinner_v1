import { getChatById, listMessagesForPrompt } from "./chats-repository";
import { getEntityProfileById } from "./entity-profiles-repository";
import { getSelectedUserPerson } from "./user-persons-repository";
import { buildChatSessionViewSafe } from "./session-view";

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

function enrichTemplateContext(base: PromptTemplateRenderContext): PromptTemplateRenderContext {
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

  // World Info / anchors are not implemented yet in TaleSpinner v1 -> keep empty strings.
  base.anchorBefore = "";
  base.anchorAfter = "";
  base.wiBefore = "";
  base.wiAfter = "";
  base.loreBefore = "";
  base.loreAfter = "";

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
    return enrichTemplateContext(base);
  }

  const chat = await getChatById(params.chatId);
  const branchId = params.branchId ?? chat?.activeBranchId ?? null;
  const entityProfileId = params.entityProfileId ?? chat?.entityProfileId ?? null;

  // If chat exists but branch is not resolved (shouldn't happen in v1), keep empty history.
  const history =
    branchId && params.chatId
      ? await listMessagesForPrompt({
          chatId: params.chatId,
          branchId,
          limit: params.historyLimit ?? 50,
          excludeMessageIds: params.excludeMessageIds,
        })
      : [];

  const entityProfile = entityProfileId
    ? await getEntityProfileById(entityProfileId)
    : null;

  const sessionView = await buildChatSessionViewSafe({
    ownerId,
    chatId: params.chatId,
  });

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
    art: sessionView.art,
    now: new Date().toISOString(),
  });
}

