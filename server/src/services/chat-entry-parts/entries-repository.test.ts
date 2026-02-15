import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };

  selectChain.from.mockImplementation(() => selectChain);
  selectChain.where.mockImplementation(() => selectChain);
  selectChain.orderBy.mockImplementation(() => selectChain);

  const db = {
    select: vi.fn(() => selectChain),
  };

  return {
    initDb: vi.fn(async () => db),
    selectChain,
  };
});

vi.mock("../../db/client", () => ({
  initDb: mocks.initDb,
}));

import { listEntriesPage } from "./entries-repository";

function makeEntryRow(overrides?: Partial<any>): any {
  return {
    entryId: "entry-1",
    ownerId: "global",
    chatId: "chat-1",
    branchId: "branch-1",
    role: "assistant",
    createdAt: new Date("2026-02-10T10:00:00.000Z"),
    activeVariantId: "variant-1",
    softDeleted: false,
    softDeletedAt: null,
    softDeletedBy: null,
    metaJson: null,
    ...overrides,
  };
}

describe("entries-repository listEntriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectChain.limit.mockResolvedValue([]);
  });

  test("uses overfetch and returns pageInfo cursor from oldest visible entry", async () => {
    mocks.selectChain.limit.mockResolvedValue([
      makeEntryRow({ entryId: "entry-300", createdAt: new Date("2026-02-10T10:03:00.000Z") }),
      makeEntryRow({ entryId: "entry-200", createdAt: new Date("2026-02-10T10:02:00.000Z") }),
      makeEntryRow({ entryId: "entry-100", createdAt: new Date("2026-02-10T10:01:00.000Z") }),
    ]);

    const result = await listEntriesPage({
      chatId: "chat-1",
      branchId: "branch-1",
      limit: 2,
    });

    expect(mocks.selectChain.limit).toHaveBeenCalledWith(3);
    expect(result.entries.map((item) => item.entryId)).toEqual(["entry-200", "entry-300"]);
    expect(result.pageInfo).toEqual({
      hasMoreOlder: true,
      nextCursor: {
        createdAt: new Date("2026-02-10T10:02:00.000Z").getTime(),
        entryId: "entry-200",
      },
    });
  });

  test("keeps deterministic order when createdAt values are equal", async () => {
    const sameDate = new Date("2026-02-10T10:02:00.000Z");
    mocks.selectChain.limit.mockResolvedValue([
      makeEntryRow({ entryId: "entry-z", createdAt: sameDate }),
      makeEntryRow({ entryId: "entry-a", createdAt: sameDate }),
      makeEntryRow({ entryId: "entry-0", createdAt: new Date("2026-02-10T10:01:00.000Z") }),
    ]);

    const result = await listEntriesPage({
      chatId: "chat-1",
      branchId: "branch-1",
      limit: 2,
    });

    expect(result.entries.map((item) => item.entryId)).toEqual(["entry-a", "entry-z"]);
    expect(result.pageInfo.nextCursor?.entryId).toBe("entry-a");
  });

  test("returns no cursor when there are no older rows", async () => {
    mocks.selectChain.limit.mockResolvedValue([
      makeEntryRow({ entryId: "entry-200", createdAt: new Date("2026-02-10T10:02:00.000Z") }),
      makeEntryRow({ entryId: "entry-100", createdAt: new Date("2026-02-10T10:01:00.000Z") }),
    ]);

    const result = await listEntriesPage({
      chatId: "chat-1",
      branchId: "branch-1",
      limit: 2,
    });

    expect(result.pageInfo).toEqual({
      hasMoreOlder: false,
      nextCursor: null,
    });
  });
});
