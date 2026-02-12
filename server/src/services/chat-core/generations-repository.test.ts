import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  const updateChain = {
    set: vi.fn(),
    where: vi.fn(),
  };

  selectChain.from.mockImplementation(() => selectChain);
  selectChain.where.mockImplementation(() => selectChain);
  selectChain.orderBy.mockImplementation(() => selectChain);
  updateChain.set.mockImplementation(() => updateChain);
  updateChain.where.mockResolvedValue(undefined);

  const db = {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  };

  return {
    initDb: vi.fn(async () => db),
    db,
    selectChain,
    updateChain,
  };
});

vi.mock("../../db/client", () => ({
  initDb: mocks.initDb,
}));

import {
  getGenerationByIdWithDebug,
  getLatestGenerationByChatBranchWithDebug,
  updateGenerationDebugJson,
} from "./generations-repository";

function makeGenerationRow(overrides?: Partial<any>): any {
  return {
    id: "gen-1",
    ownerId: "global",
    chatId: "chat-1",
    branchId: "branch-1",
    messageId: null,
    variantId: "variant-1",
    providerId: "provider-1",
    model: "model-1",
    paramsJson: "{}",
    status: "done",
    startedAt: new Date("2026-02-12T10:00:00.000Z"),
    finishedAt: new Date("2026-02-12T10:00:05.000Z"),
    promptHash: "hash-1",
    promptSnapshotJson: JSON.stringify({
      v: 1,
      messages: [{ role: "system", content: "sys" }],
      truncated: false,
      meta: { historyLimit: 50, historyReturnedCount: 1 },
    }),
    debugJson: JSON.stringify({
      estimator: "chars_div4",
      prompt: { messages: [], approxTokens: { total: 0, byRole: { system: 0, user: 0, assistant: 0 }, sections: {} } },
    }),
    phaseReportJson: null,
    commitReportJson: null,
    promptTokens: null,
    completionTokens: null,
    error: null,
    ...overrides,
  };
}

describe("generations-repository diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectChain.limit.mockResolvedValue([]);
  });

  test("updates debug_json payload", async () => {
    await updateGenerationDebugJson({
      id: "gen-1",
      debug: {
        estimator: "chars_div4",
        prompt: { messages: [{ role: "system", content: "sys" }] },
      },
    });

    expect(mocks.db.update).toHaveBeenCalled();
    const setArg = mocks.updateChain.set.mock.calls[0]?.[0] as { debugJson?: string | null };
    expect(typeof setArg?.debugJson).toBe("string");
    expect(setArg?.debugJson ?? "").toContain('"estimator":"chars_div4"');
  });

  test("reads generation with parsed debug + prompt snapshot", async () => {
    mocks.selectChain.limit.mockResolvedValue([makeGenerationRow()]);

    const result = await getGenerationByIdWithDebug("gen-1");

    expect(result?.id).toBe("gen-1");
    expect(result?.promptHash).toBe("hash-1");
    expect(result?.promptSnapshot).toEqual(
      expect.objectContaining({
        v: 1,
      })
    );
    expect(result?.debug).toEqual(
      expect.objectContaining({
        estimator: "chars_div4",
      })
    );
  });

  test("reads latest generation by chat+branch with debug", async () => {
    mocks.selectChain.limit.mockResolvedValue([
      makeGenerationRow({
        id: "gen-latest",
        status: "streaming",
      }),
    ]);

    const result = await getLatestGenerationByChatBranchWithDebug({
      chatId: "chat-1",
      branchId: "branch-1",
    });

    expect(result?.id).toBe("gen-latest");
    expect(result?.status).toBe("streaming");
    expect(result?.debug).toEqual(expect.any(Object));
  });
});
