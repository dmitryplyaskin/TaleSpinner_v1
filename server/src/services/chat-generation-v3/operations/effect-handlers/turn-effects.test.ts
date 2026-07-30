import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPartWithVariantContextById: vi.fn(),
  createPart: vi.fn(),
  updatePartPayloadText: vi.fn(),
}));

vi.mock("../../../chat-entry-parts/parts-repository", () => ({
  getPartWithVariantContextById: mocks.getPartWithVariantContextById,
  createPart: mocks.createPart,
  updatePartPayloadText: mocks.updatePartPayloadText,
}));

import { persistAssistantTurnText, persistUserTurnText } from "./turn-effects";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPartWithVariantContextById.mockResolvedValue({
    ownerId: "global",
    variantId: "variant-1",
    entryId: "entry-1",
    part: {
      partId: "part-1",
      channel: "main",
      order: 0,
      payload: "original user text",
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: 3,
      source: "user",
      tags: [],
    },
  });
  mocks.createPart.mockResolvedValue({
    partId: "part-2",
    channel: "main",
    order: 0,
    payload: "normalized user text",
    payloadFormat: "markdown",
    visibility: { ui: "always", prompt: true },
    ui: { rendererId: "markdown" },
    prompt: { serializerId: "asText" },
    lifespan: "infinite",
    createdTurn: 3,
    source: "agent",
    replacesPartId: "part-1",
    tags: ["canonicalization"],
  });
  mocks.updatePartPayloadText.mockResolvedValue(undefined);
});

describe("persistAssistantTurnText", () => {
  test("updates the assistant main part after validating its entry", async () => {
    const result = await persistAssistantTurnText({
      target: {
        mode: "entry_parts",
        assistantEntryId: "entry-1",
        assistantMainPartId: "part-1",
      },
      text: "normalized assistant text",
    });

    expect(mocks.updatePartPayloadText).toHaveBeenCalledWith({
      partId: "part-1",
      payloadText: "normalized assistant text",
      payloadFormat: "markdown",
    });
    expect(result).toEqual({
      previousText: "original user text",
      assistantEntryId: "entry-1",
      assistantMainPartId: "part-1",
    });
  });

  test("does not write when the assistant entry does not match", async () => {
    await expect(
      persistAssistantTurnText({
        target: {
          mode: "entry_parts",
          assistantEntryId: "entry-other",
          assistantMainPartId: "part-1",
        },
        text: "normalized assistant text",
      })
    ).rejects.toThrow(/entry mismatch/);
    expect(mocks.updatePartPayloadText).not.toHaveBeenCalled();
  });
});

describe("persistUserTurnText", () => {
  test("throws when target is missing", async () => {
    await expect(persistUserTurnText({ target: undefined, text: "x" })).rejects.toThrow(
      /target is required/
    );
    expect(mocks.getPartWithVariantContextById).not.toHaveBeenCalled();
    expect(mocks.createPart).not.toHaveBeenCalled();
  });

  test("creates replacement part and returns canonicalization metadata", async () => {
    const result = await persistUserTurnText({
      target: {
        mode: "entry_parts",
        userEntryId: "entry-1",
        userMainPartId: "part-1",
      },
      text: "normalized user text",
    });

    expect(mocks.getPartWithVariantContextById).toHaveBeenCalledWith({
      partId: "part-1",
    });
    expect(mocks.createPart).toHaveBeenCalledWith({
      ownerId: "global",
      variantId: "variant-1",
      channel: "main",
      order: 0,
      payload: "normalized user text",
      payloadFormat: "markdown",
      schemaId: undefined,
      label: undefined,
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: 3,
      source: "agent",
      agentId: undefined,
      model: undefined,
      requestId: undefined,
      replacesPartId: "part-1",
      tags: ["canonicalization"],
    });
    expect(result).toEqual({
      previousText: "original user text",
      replacedPartId: "part-1",
      canonicalPartId: "part-2",
      userEntryId: "entry-1",
    });
  });

  test("throws when part context does not match user target", async () => {
    mocks.getPartWithVariantContextById.mockResolvedValueOnce({
      ownerId: "global",
      variantId: "variant-1",
      entryId: "entry-other",
      part: {
        partId: "part-1",
        channel: "main",
        order: 0,
        payload: "original user text",
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: 3,
        source: "user",
      },
    });

    await expect(
      persistUserTurnText({
        target: {
          mode: "entry_parts",
          userEntryId: "entry-1",
          userMainPartId: "part-1",
        },
        text: "normalized user text",
      })
    ).rejects.toThrow(/entry mismatch/);
    expect(mocks.createPart).not.toHaveBeenCalled();
  });
});
