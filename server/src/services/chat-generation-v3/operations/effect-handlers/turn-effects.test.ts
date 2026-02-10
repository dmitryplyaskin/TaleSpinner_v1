import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updatePartPayloadText: vi.fn(),
}));

vi.mock("../../../chat-entry-parts/parts-repository", () => ({
  updatePartPayloadText: mocks.updatePartPayloadText,
}));

import { persistUserTurnText } from "./turn-effects";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updatePartPayloadText.mockResolvedValue(undefined);
});

describe("persistUserTurnText", () => {
  test("throws when target is missing", async () => {
    await expect(persistUserTurnText({ target: undefined, text: "x" })).rejects.toThrow(
      /target is required/
    );
    expect(mocks.updatePartPayloadText).not.toHaveBeenCalled();
  });

  test("delegates user text update with markdown format", async () => {
    await persistUserTurnText({
      target: {
        mode: "entry_parts",
        userEntryId: "entry-1",
        userMainPartId: "part-1",
      },
      text: "normalized user text",
    });

    expect(mocks.updatePartPayloadText).toHaveBeenCalledWith({
      partId: "part-1",
      payloadText: "normalized user text",
      payloadFormat: "markdown",
    });
  });
});
