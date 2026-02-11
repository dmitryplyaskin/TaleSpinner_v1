import { listEntries, hasActiveUserEntriesInBranch } from "../chat-entry-parts/entries-repository";
import { updatePartPayloadText } from "../chat-entry-parts/parts-repository";
import { listEntryVariants, updateVariantDerived } from "../chat-entry-parts/variants-repository";

import {
  buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "./prompt-template-context";
import { renderLiquidTemplate } from "./prompt-template-renderer";

import type { Entry, Part, Variant } from "@shared/types/chat-entry-parts";

type TemplateSeedMeta = {
  engine: "liquidjs";
  rawTemplate: string;
  renderedForUserPersonId: string | null;
  renderedAt: string;
  renderError?: string;
};

const TEMPLATE_MAX_PASSES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseTemplateSeed(derived: unknown): TemplateSeedMeta | null {
  if (!isRecord(derived)) return null;
  const raw = derived.templateSeed;
  if (!isRecord(raw)) return null;
  const engine = raw.engine;
  const rawTemplate = raw.rawTemplate;
  const renderedForUserPersonId = raw.renderedForUserPersonId;
  const renderedAt = raw.renderedAt;
  const renderError = raw.renderError;
  if (engine !== "liquidjs") return null;
  if (typeof rawTemplate !== "string") return null;
  return {
    engine: "liquidjs",
    rawTemplate,
    renderedForUserPersonId:
      typeof renderedForUserPersonId === "string" ? renderedForUserPersonId : null,
    renderedAt: typeof renderedAt === "string" ? renderedAt : "",
    renderError: typeof renderError === "string" ? renderError : undefined,
  };
}

function getGreetingEntry(entries: Entry[]): Entry | null {
  return (
    entries.find((entry) => {
      if (entry.role !== "assistant") return false;
      if (!isRecord(entry.meta)) return false;
      return (
        entry.meta.source === "entity_profile_import" &&
        entry.meta.kind === "first_mes"
      );
    }) ?? null
  );
}

function pickMainTextPart(variant: Variant): Part | null {
  const parts = (variant.parts ?? [])
    .filter((part) => !part.softDeleted)
    .filter((part) => part.channel === "main")
    .filter((part) => typeof part.payload === "string")
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.partId.localeCompare(b.partId);
    });
  if (parts.length === 0) return null;
  return parts[parts.length - 1] ?? null;
}

function extractUserId(user: unknown): string | null {
  if (!isRecord(user)) return null;
  return typeof user.id === "string" ? user.id : null;
}

export async function rerenderGreetingTemplatesIfPreplay(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
}): Promise<void> {
  const hasUserEntries = await hasActiveUserEntriesInBranch({
    chatId: params.chatId,
    branchId: params.branchId,
  });
  if (hasUserEntries) return;

  const entries = await listEntries({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: 500,
  });
  const greetingEntry = getGreetingEntry(entries);
  if (!greetingEntry) return;

  const variants = await listEntryVariants({ entryId: greetingEntry.entryId });
  if (variants.length === 0) return;

  const templateContext = await buildPromptTemplateRenderContext({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    historyLimit: 50,
  });
  await resolveAndApplyWorldInfoToTemplateContext({
    context: templateContext,
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    trigger: "generate",
    dryRun: true,
  });
  const selectedUserId = extractUserId(templateContext.user);

  for (const variant of variants) {
    const mainPart = pickMainTextPart(variant);
    if (!mainPart) continue;

    const currentPayloadText = toText(mainPart.payload);
    const currentSeed = parseTemplateSeed(variant.derived);
    const rawTemplate = currentSeed?.rawTemplate ?? currentPayloadText;
    if (rawTemplate.length === 0) continue;

    const baseSeed: TemplateSeedMeta = {
      engine: "liquidjs",
      rawTemplate,
      renderedForUserPersonId: selectedUserId,
      renderedAt: new Date().toISOString(),
    };

    try {
      const rendered = String(
        await renderLiquidTemplate({
          templateText: rawTemplate,
          context: templateContext,
          options: {
            strictVariables: false,
            maxPasses: TEMPLATE_MAX_PASSES,
          },
        })
      );

      if (rendered !== currentPayloadText) {
        await updatePartPayloadText({
          partId: mainPart.partId,
          payloadText: rendered,
          payloadFormat: mainPart.payloadFormat,
        });
      }

      const derivedBase = isRecord(variant.derived)
        ? { ...variant.derived }
        : ({} as Record<string, unknown>);
      await updateVariantDerived({
        variantId: variant.variantId,
        derived: {
          ...derivedBase,
          templateSeed: baseSeed,
        },
      });
    } catch (error) {
      const derivedBase = isRecord(variant.derived)
        ? { ...variant.derived }
        : ({} as Record<string, unknown>);
      await updateVariantDerived({
        variantId: variant.variantId,
        derived: {
          ...derivedBase,
          templateSeed: {
            ...baseSeed,
            renderError: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }
}
