import { listProjectedPromptMessages } from "../chat-entry-parts/prompt-history";
import { resolveWorldInfoRuntimeForChat } from "../world-info/world-info-runtime";

import { getChatById } from "./chats-repository";
import { getEntityProfileById } from "./entity-profiles-repository";
import { renderLiquidTemplate } from "./prompt-template-renderer";
import { getSelectedUserPerson } from "./user-persons-repository";

import type { PromptTemplateRenderContext } from "./prompt-template-renderer";
import type {
  PreparedWorldInfoEntry,
  WorldInfoDepthEntry,
} from "../world-info/world-info-types";
import type { OperationTrigger } from "@shared/types/operation-profiles";

export type PromptTemplateWorldInfoInput = {
  worldInfoBefore?: string;
  worldInfoAfter?: string;
  anchorBefore?: string;
  anchorAfter?: string;
  wiBefore?: string;
  wiAfter?: string;
  loreBefore?: string;
  loreAfter?: string;
  depthEntries?: WorldInfoDepthEntry[];
  outletEntries?: Record<string, string[]>;
  anTop?: string[];
  anBottom?: string[];
  emTop?: string[];
  emBottom?: string[];
};

export type PromptTemplateResolvedWorldInfo = {
  worldInfoBefore: string;
  worldInfoAfter: string;
  depthEntries: WorldInfoDepthEntry[];
  outletEntries: Record<string, string[]>;
  anTop: string[];
  anBottom: string[];
  emTop: string[];
  emBottom: string[];
  warnings: string[];
  activatedCount: number;
  activatedEntries: PromptTemplateResolvedWorldInfoActivationEntry[];
};

export type PromptTemplateResolvedWorldInfoActivationReason =
  | "decorator_activate"
  | "constant"
  | "key_match"
  | "runtime_activation";

export type PromptTemplateResolvedWorldInfoActivationEntry = {
  hash: string;
  bookId: string;
  bookName: string;
  uid: number;
  comment: string;
  content: string;
  matchedKeys: string[];
  reasons: PromptTemplateResolvedWorldInfoActivationReason[];
};

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

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string");
}

function normalizeOutletEntries(
  value: unknown
): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, rawItems] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    out[normalizedKey] = asStringArray(rawItems);
  }
  return out;
}

function buildOutletJoinedValues(
  outletEntries: Record<string, string[]>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(outletEntries).map(([key, items]) => [key, items.join("\n")])
  );
}

function createEmptyResolvedWorldInfo(): PromptTemplateResolvedWorldInfo {
  return {
    worldInfoBefore: "",
    worldInfoAfter: "",
    depthEntries: [],
    outletEntries: {},
    anTop: [],
    anBottom: [],
    emTop: [],
    emBottom: [],
    warnings: [],
    activatedCount: 0,
    activatedEntries: [],
  };
}

function cloneTemplateContextForWorldInfoRender(
  context: PromptTemplateRenderContext,
  worldInfo: PromptTemplateResolvedWorldInfo
): PromptTemplateRenderContext {
  const cloned: PromptTemplateRenderContext = {
    ...context,
    messages: Array.isArray(context.messages)
      ? context.messages.map((m) => ({ role: m.role, content: m.content }))
      : [],
    outlet: context.outlet ? { ...context.outlet } : {},
    outletEntries: context.outletEntries
      ? Object.fromEntries(
          Object.entries(context.outletEntries).map(([key, items]) => [key, [...items]])
        )
      : {},
    anTop: context.anTop ? [...context.anTop] : [],
    anBottom: context.anBottom ? [...context.anBottom] : [],
    emTop: context.emTop ? [...context.emTop] : [],
    emBottom: context.emBottom ? [...context.emBottom] : [],
  };
  applyWorldInfoToTemplateContext(cloned, worldInfo);
  return cloned;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function deriveWorldInfoActivationReasons(params: {
  entry: Pick<PreparedWorldInfoEntry, "decorators" | "constant">;
  matchedKeys: string[];
}): PromptTemplateResolvedWorldInfoActivationReason[] {
  const reasons: PromptTemplateResolvedWorldInfoActivationReason[] = [];
  if (params.entry.decorators.activate) reasons.push("decorator_activate");
  if (params.entry.constant) reasons.push("constant");
  if (params.matchedKeys.length > 0) reasons.push("key_match");
  if (reasons.length === 0) reasons.push("runtime_activation");
  return reasons;
}

function mapActivatedWorldInfoEntries(params: {
  activatedEntries: PreparedWorldInfoEntry[];
  matchedKeysByHash: Record<string, string[]>;
}): PromptTemplateResolvedWorldInfoActivationEntry[] {
  return params.activatedEntries.map((entry) => {
    const matchedKeys = asStringArray(params.matchedKeysByHash[entry.hash]);
    return {
      hash: entry.hash,
      bookId: entry.bookId,
      bookName: entry.bookName,
      uid: entry.uid,
      comment: entry.comment,
      content: entry.content,
      matchedKeys,
      reasons: deriveWorldInfoActivationReasons({ entry, matchedKeys }),
    };
  });
}

async function renderWorldInfoTextWithLiquid(params: {
  content: string;
  context: PromptTemplateRenderContext;
  warnings: string[];
  warningKey: string;
}): Promise<string> {
  if (params.content.length === 0) return params.content;
  try {
    return String(
      await renderLiquidTemplate({
        templateText: params.content,
        context: params.context,
      })
    );
  } catch (error) {
    params.warnings.push(
      `world_info_liquid_render_error:${params.warningKey}:${toErrorMessage(error)}`
    );
    return params.content;
  }
}

async function renderResolvedWorldInfoWithLiquid(params: {
  resolved: PromptTemplateResolvedWorldInfo;
  context: PromptTemplateRenderContext;
}): Promise<PromptTemplateResolvedWorldInfo> {
  const warnings = [...params.resolved.warnings];
  const renderContext = cloneTemplateContextForWorldInfoRender(
    params.context,
    params.resolved
  );

  const worldInfoBefore = await renderWorldInfoTextWithLiquid({
    content: params.resolved.worldInfoBefore,
    context: renderContext,
    warnings,
    warningKey: "worldInfoBefore",
  });
  const worldInfoAfter = await renderWorldInfoTextWithLiquid({
    content: params.resolved.worldInfoAfter,
    context: renderContext,
    warnings,
    warningKey: "worldInfoAfter",
  });
  const depthEntries = await Promise.all(
    params.resolved.depthEntries.map(async (entry, idx) => ({
      ...entry,
      content: await renderWorldInfoTextWithLiquid({
        content: entry.content,
        context: renderContext,
        warnings,
        warningKey: `depthEntries.${idx}`,
      }),
    }))
  );
  const outletEntries = Object.fromEntries(
    await Promise.all(
      Object.entries(params.resolved.outletEntries).map(async ([key, items]) => {
        const renderedItems = await Promise.all(
          items.map((content, idx) =>
            renderWorldInfoTextWithLiquid({
              content,
              context: renderContext,
              warnings,
              warningKey: `outletEntries.${key}.${idx}`,
            })
          )
        );
        return [key, renderedItems];
      })
    )
  );
  const anTop = await Promise.all(
    params.resolved.anTop.map((content, idx) =>
      renderWorldInfoTextWithLiquid({
        content,
        context: renderContext,
        warnings,
        warningKey: `anTop.${idx}`,
      })
    )
  );
  const anBottom = await Promise.all(
    params.resolved.anBottom.map((content, idx) =>
      renderWorldInfoTextWithLiquid({
        content,
        context: renderContext,
        warnings,
        warningKey: `anBottom.${idx}`,
      })
    )
  );
  const emTop = await Promise.all(
    params.resolved.emTop.map((content, idx) =>
      renderWorldInfoTextWithLiquid({
        content,
        context: renderContext,
        warnings,
        warningKey: `emTop.${idx}`,
      })
    )
  );
  const emBottom = await Promise.all(
    params.resolved.emBottom.map((content, idx) =>
      renderWorldInfoTextWithLiquid({
        content,
        context: renderContext,
        warnings,
        warningKey: `emBottom.${idx}`,
      })
    )
  );
  const activatedEntries = await Promise.all(
    params.resolved.activatedEntries.map(async (entry, idx) => ({
      ...entry,
      content: await renderWorldInfoTextWithLiquid({
        content: entry.content,
        context: renderContext,
        warnings,
        warningKey: `activatedEntries.${idx}`,
      }),
    }))
  );

  return {
    ...params.resolved,
    worldInfoBefore,
    worldInfoAfter,
    depthEntries,
    outletEntries,
    anTop,
    anBottom,
    emTop,
    emBottom,
    activatedEntries,
    warnings,
  };
}

export function applyWorldInfoToTemplateContext(
  base: PromptTemplateRenderContext,
  worldInfo?: PromptTemplateWorldInfoInput
): PromptTemplateRenderContext {
  const worldInfoBefore = asString(
    worldInfo?.worldInfoBefore ??
      worldInfo?.wiBefore ??
      worldInfo?.loreBefore ??
      worldInfo?.anchorBefore
  );
  const worldInfoAfter = asString(
    worldInfo?.worldInfoAfter ??
      worldInfo?.wiAfter ??
      worldInfo?.loreAfter ??
      worldInfo?.anchorAfter
  );

  base.anchorBefore = asString(worldInfo?.anchorBefore ?? worldInfoBefore);
  base.anchorAfter = asString(worldInfo?.anchorAfter ?? worldInfoAfter);
  base.wiBefore = asString(worldInfo?.wiBefore ?? worldInfoBefore);
  base.wiAfter = asString(worldInfo?.wiAfter ?? worldInfoAfter);
  base.loreBefore = asString(worldInfo?.loreBefore ?? worldInfoBefore);
  base.loreAfter = asString(worldInfo?.loreAfter ?? worldInfoAfter);

  const outletEntries = normalizeOutletEntries(worldInfo?.outletEntries);
  base.outletEntries = outletEntries;
  base.outlet = buildOutletJoinedValues(outletEntries);

  base.anTop = asStringArray(worldInfo?.anTop);
  base.anBottom = asStringArray(worldInfo?.anBottom);
  base.emTop = asStringArray(worldInfo?.emTop);
  base.emBottom = asStringArray(worldInfo?.emBottom);

  return base;
}

export async function resolveWorldInfoForTemplateContext(params: {
  ownerId: string;
  chatId?: string;
  branchId?: string;
  entityProfileId?: string;
  trigger?: OperationTrigger;
  history: Array<{ role: string; content: string }>;
  scanSeed?: string;
  dryRun?: boolean;
}): Promise<PromptTemplateResolvedWorldInfo> {
  if (!params.chatId) return createEmptyResolvedWorldInfo();

  try {
    const resolved = await resolveWorldInfoRuntimeForChat({
      ownerId: params.ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      entityProfileId: params.entityProfileId,
      trigger: params.trigger ?? "generate",
      history: params.history,
      scanSeed:
        params.scanSeed ??
        `${params.ownerId}:${params.chatId}:${params.branchId ?? "auto"}:${params.trigger ?? "generate"}:${Date.now()}`,
      dryRun: params.dryRun ?? true,
    });

    return {
      worldInfoBefore: resolved.worldInfoBefore,
      worldInfoAfter: resolved.worldInfoAfter,
      depthEntries: resolved.depthEntries,
      outletEntries: resolved.outletEntries,
      anTop: resolved.anTop,
      anBottom: resolved.anBottom,
      emTop: resolved.emTop,
      emBottom: resolved.emBottom,
      warnings: [...resolved.debug.warnings],
      activatedCount: resolved.activatedEntries.length,
      activatedEntries: mapActivatedWorldInfoEntries({
        activatedEntries: resolved.activatedEntries,
        matchedKeysByHash: resolved.debug.matchedKeys,
      }),
    };
  } catch {
    return createEmptyResolvedWorldInfo();
  }
}

export async function resolveAndApplyWorldInfoToTemplateContext(params: {
  context: PromptTemplateRenderContext;
  ownerId: string;
  chatId?: string;
  branchId?: string;
  entityProfileId?: string;
  trigger?: OperationTrigger;
  scanSeed?: string;
  dryRun?: boolean;
}): Promise<PromptTemplateResolvedWorldInfo> {
  const resolvedRaw = await resolveWorldInfoForTemplateContext({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    trigger: params.trigger,
    history: params.context.messages,
    scanSeed: params.scanSeed,
    dryRun: params.dryRun,
  });
  const resolved = await renderResolvedWorldInfoWithLiquid({
    resolved: resolvedRaw,
    context: params.context,
  });
  applyWorldInfoToTemplateContext(params.context, resolved);
  return resolved;
}

function enrichTemplateContext(
  base: PromptTemplateRenderContext,
  worldInfo?: PromptTemplateWorldInfoInput
): PromptTemplateRenderContext {
  const charObj = isRecord(base.char) ? base.char : {};
  const userObj = isRecord(base.user) ? base.user : {};

  // Make `{{char}}` and `{{user}}` behave like SillyTavern macros (name strings),
  // without breaking existing templates that expect `{{char.name}}` / `{{user.name}}`.
  const charName = asString(charObj.name).trim();
  defineToString(charObj, charName);

  const userName = asString(userObj.name).trim();
  defineToString(userObj, userName);

  // SillyTavern-style top-level aliases (best-effort).
  // Many of these are used by ST "Story String" templates.
  base.description = asString(charObj.description);
  base.scenario = asString(charObj.scenario);
  base.personality = asString(charObj.personality);
  base.system = asString(charObj.system_prompt);

  // ST-style persona description alias.
  base.persona = asString(userObj.contentTypeDefault) || asString(userObj.prefix);

  // Example messages: we store CC field as `mes_example`.
  base.mesExamplesRaw = asString(charObj.mes_example);
  base.mesExamples = base.mesExamplesRaw;

  base.char = charObj;
  base.user = userObj;
  return applyWorldInfoToTemplateContext(base, worldInfo);
}

export async function buildPromptTemplateRenderContext(params: {
  ownerId?: string;
  chatId?: string;
  branchId?: string;
  entityProfileId?: string;
  historyLimit?: number;
  excludeMessageIds?: string[];
  excludeEntryIds?: string[];
  worldInfo?: PromptTemplateWorldInfoInput;
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

