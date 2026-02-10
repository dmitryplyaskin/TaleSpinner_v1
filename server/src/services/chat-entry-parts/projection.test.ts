import { describe, expect, it } from "vitest";

import { getPromptProjection, getUiProjection } from "./projection";
import { serializePart } from "./prompt-serializers";

import type { Entry, Part, Variant } from "@shared/types/chat-entry-parts";

function mkEntry(params: Partial<Entry> & Pick<Entry, "entryId" | "role">): Entry {
  return {
    entryId: params.entryId,
    chatId: params.chatId ?? "c1",
    branchId: params.branchId ?? "b1",
    role: params.role,
    createdAt: params.createdAt ?? Date.now(),
    activeVariantId: params.activeVariantId ?? "v1",
    softDeleted: params.softDeleted,
    meta: params.meta,
  };
}

function mkVariant(params: Partial<Variant> & Pick<Variant, "variantId" | "entryId">): Variant {
  return {
    variantId: params.variantId,
    entryId: params.entryId,
    kind: params.kind ?? "generation",
    createdAt: params.createdAt ?? Date.now(),
    parts: params.parts ?? [],
    derived: params.derived,
  };
}

function mkPart(params: Partial<Part> & Pick<Part, "partId" | "channel" | "order">): Part {
  return {
    partId: params.partId,
    channel: params.channel,
    order: params.order,
    payload: params.payload ?? "",
    payloadFormat: params.payloadFormat ?? "markdown",
    visibility: params.visibility ?? { ui: "always", prompt: true },
    ui: params.ui ?? { rendererId: "markdown" },
    prompt: params.prompt ?? { serializerId: "asText" },
    lifespan: params.lifespan ?? "infinite",
    createdTurn: params.createdTurn ?? 0,
    source: params.source ?? "llm",
    replacesPartId: params.replacesPartId,
    softDeleted: params.softDeleted,
  };
}

describe("chat-entry-parts projection", () => {
  it("filters TTL-expired parts in UI projection", () => {
    const entry = mkEntry({ entryId: "e1", role: "assistant" });
    const variant = mkVariant({
      variantId: "v1",
      entryId: "e1",
      parts: [
        mkPart({
          partId: "p1",
          channel: "aux",
          order: 10,
          payload: "old",
          lifespan: { turns: 1 },
          createdTurn: 0,
        }),
        mkPart({
          partId: "p2",
          channel: "main",
          order: 0,
          payload: "main",
          lifespan: "infinite",
          createdTurn: 0,
        }),
      ],
    });

    const visible = getUiProjection(entry, variant, 1, { debugEnabled: false });
    expect(visible.map((p) => p.partId)).toEqual(["p2"]);
  });

  it("hides replaced originals in UI projection", () => {
    const entry = mkEntry({ entryId: "e1", role: "assistant" });
    const orig = mkPart({ partId: "orig", channel: "main", order: 0, payload: "A" });
    const repl = mkPart({
      partId: "repl",
      channel: "main",
      order: 0,
      payload: "B",
      replacesPartId: "orig",
      createdTurn: 2,
    });
    const variant = mkVariant({ variantId: "v1", entryId: "e1", parts: [orig, repl] });
    const visible = getUiProjection(entry, variant, 10, { debugEnabled: false });
    expect(visible.map((p) => p.partId)).toEqual(["repl"]);
  });

  it("resolves replacement conflicts deterministically (prefer higher createdTurn)", () => {
    const entry = mkEntry({ entryId: "e1", role: "assistant" });
    const orig = mkPart({ partId: "orig", channel: "main", order: 0, payload: "A", createdTurn: 0 });
    const r1 = mkPart({ partId: "r1", channel: "main", order: 0, payload: "B", replacesPartId: "orig", createdTurn: 1 });
    const r2 = mkPart({ partId: "r2", channel: "main", order: 0, payload: "C", replacesPartId: "orig", createdTurn: 3 });
    const variant = mkVariant({ variantId: "v1", entryId: "e1", parts: [orig, r1, r2] });
    const visible = getUiProjection(entry, variant, 10, { debugEnabled: false });
    expect(visible.map((p) => p.partId)).toEqual(["r2"]);
  });

  it("includes only prompt-visible parts in prompt projection", () => {
    const entry = mkEntry({ entryId: "e1", role: "user" });
    const variant = mkVariant({
      variantId: "v1",
      entryId: "e1",
      parts: [
        mkPart({
          partId: "ui_only",
          channel: "aux",
          order: 10,
          payload: "debug",
          visibility: { ui: "always", prompt: false },
        }),
        mkPart({
          partId: "prompt",
          channel: "main",
          order: 0,
          payload: "hello",
          visibility: { ui: "always", prompt: true },
        }),
      ],
    });

    const msgs = getPromptProjection({
      entries: [{ entry, variant }],
      currentTurn: 0,
      serializePart,
    });

    expect(msgs).toEqual([{ role: "user", content: "hello" }]);
  });

  it("excludes entries marked as excludedFromPrompt from prompt projection", () => {
    const entry = mkEntry({
      entryId: "e1",
      role: "assistant",
      meta: { excludedFromPrompt: true },
    });
    const variant = mkVariant({
      variantId: "v1",
      entryId: "e1",
      parts: [
        mkPart({
          partId: "main",
          channel: "main",
          order: 0,
          payload: "hidden from prompt",
          visibility: { ui: "always", prompt: true },
        }),
      ],
    });

    const msgs = getPromptProjection({
      entries: [{ entry, variant }],
      currentTurn: 0,
      serializePart,
    });

    expect(msgs).toEqual([]);
  });
});

