import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "@core/request-context/owner-scope-storage";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import { chatBranches, chats, entityProfiles } from "../../db/schema";

import {
  createKnowledgeCollection,
  exportKnowledgeCollection,
  importKnowledgeCollection,
  listKnowledgeCollections,
} from "./knowledge-collections-repository";
import {
  getKnowledgeRecordById,
  listKnowledgeRecords,
  upsertKnowledgeRecord,
} from "./knowledge-records-repository";
import { revealKnowledgeRecords } from "./knowledge-reveal-service";
import { searchKnowledgeRecords } from "./knowledge-search-service";

async function seedChatScope(params: {
  ownerId?: string;
  chatId: string;
  branchIds?: string[];
}): Promise<void> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const now = new Date();
  const entityProfileId = `entity:${params.chatId}`;
  const branchIds = params.branchIds ?? [];

  await db.insert(entityProfiles).values({
    id: entityProfileId,
    ownerId,
    name: `Entity ${params.chatId}`,
    kind: "CharSpec",
    specJson: "{}",
    metaJson: null,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    avatarAssetId: null,
  });

  await db.insert(chats).values({
    id: params.chatId,
    ownerId,
    entityProfileId,
    title: `Chat ${params.chatId}`,
    activeBranchId: branchIds[0] ?? null,
    instructionId: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    lastMessagePreview: null,
    version: 0,
    metaJson: null,
    originChatId: null,
    originBranchId: null,
    originMessageId: null,
  });

  if (branchIds.length > 0) {
    await db.insert(chatBranches).values(
      branchIds.map((branchId) => ({
        id: branchId,
        ownerId,
        chatId: params.chatId,
        title: branchId,
        createdAt: now,
        updatedAt: now,
        parentBranchId: null,
        forkedFromMessageId: null,
        forkedFromVariantId: null,
        metaJson: null,
        currentTurn: 0,
      }))
    );
  }
}

describe("chat knowledge integration", () => {
  let tempDir = "";
  let prevDataDir: string | undefined;

  beforeEach(async () => {
    prevDataDir = process.env.TALESPINNER_DATA_DIR;
    tempDir = await mkdtemp(path.join(tmpdir(), "talespinner-knowledge-"));
    process.env.TALESPINNER_DATA_DIR = tempDir;
    resetDbForTests();
    await initDb();
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    if (typeof prevDataDir === "string") {
      process.env.TALESPINNER_DATA_DIR = prevDataDir;
    } else {
      delete process.env.TALESPINNER_DATA_DIR;
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("creates collections and records, then enforces unique key per scoped collection", async () => {
    await seedChatScope({ chatId: "chat-1" });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-1",
      branchId: null,
      scope: "chat",
      name: "Lore Pack",
      kind: "lore",
      layer: "baseline",
      origin: "import",
    });

    const first = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-1",
      branchId: null,
      collectionId: collection.id,
      recordType: "location",
      key: "dark_forest",
      title: "Dark Forest",
      aliases: ["Black Forest"],
      tags: ["forest", "curse"],
      summary: "Ancient cursed forest",
      content: {
        text: "The Dark Forest is feared by travelers.",
      },
      accessMode: "public",
      layer: "baseline",
      origin: "import",
    });

    const second = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-1",
      branchId: null,
      collectionId: collection.id,
      recordType: "location",
      key: "dark_forest",
      title: "Dark Forest Revised",
      aliases: ["Night Forest"],
      tags: ["forest", "north"],
      summary: "Updated summary",
      content: {
        text: "Updated lore text",
      },
      accessMode: "public",
      layer: "baseline",
      origin: "import",
    });

    expect(second.id).toBe(first.id);

    const records = await listKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-1",
      branchId: null,
      collectionId: collection.id,
    });
    expect(records).toHaveLength(1);
    expect(records[0]?.title).toBe("Dark Forest Revised");
  });

  test("search ranks exact key/title over tag and full-text matches", async () => {
    await seedChatScope({ chatId: "chat-search", branchIds: ["branch-a"] });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-search",
      branchId: null,
      scope: "chat",
      name: "Search Pack",
      kind: "scenario",
      layer: "baseline",
      origin: "author",
    });

    await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-search",
      branchId: null,
      collectionId: collection.id,
      recordType: "location",
      key: "dark_forest",
      title: "Dark Forest",
      aliases: ["Black Forest"],
      tags: ["forest", "curse"],
      summary: "Cursed northern forest",
      content: { text: "Dark forest with ancient curse." },
      accessMode: "public",
      layer: "baseline",
      origin: "author",
    });

    await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-search",
      branchId: null,
      collectionId: collection.id,
      recordType: "location",
      key: "magic_grove",
      title: "Magic Grove",
      aliases: ["Enchanted Forest"],
      tags: ["forest", "magic"],
      summary: "Forest filled with old spells",
      content: { text: "Magic grove with luminous trees." },
      accessMode: "public",
      layer: "baseline",
      origin: "author",
    });

    const result = await searchKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-search",
      branchId: "branch-a",
      request: {
        textQuery: "dark forest curse",
        keys: ["dark_forest"],
        limit: 10,
        minimumShouldMatch: 1,
      },
    });

    expect(result.hits[0]?.record?.key).toBe("dark_forest");
    expect(result.hits[0]?.matchReasons).toContain("key_exact");
    expect(result.hits[0]?.score).toBeGreaterThan(result.hits[1]?.score ?? 0);
  });

  test("search returns discoverable record as preview only until reveal succeeds", async () => {
    await seedChatScope({ chatId: "chat-reveal", branchIds: ["branch-main"] });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: null,
      scope: "chat",
      name: "Mystery Pack",
      kind: "scenario",
      layer: "baseline",
      origin: "import",
    });

    const clue = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: null,
      collectionId: collection.id,
      recordType: "fact",
      key: "clue_tablet",
      title: "Ancient Tablet",
      aliases: ["Stone Tablet"],
      tags: ["clue", "tablet"],
      summary: "An engraved tablet with missing symbols",
      content: { solution: "The symbol points to the catacombs." },
      accessMode: "public",
      layer: "baseline",
      origin: "import",
    });

    const hidden = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: null,
      collectionId: collection.id,
      recordType: "fact",
      key: "catacomb_secret",
      title: "Catacomb Secret",
      aliases: ["Hidden Passage"],
      tags: ["secret", "catacomb"],
      summary: "There is a sealed route below the ruins",
      content: { spoiler: "The king's remains are hidden there." },
      accessMode: "discoverable",
      layer: "baseline",
      origin: "import",
      gatePolicy: {
        read: {
          all: [{ type: "record_revealed", recordKey: "clue_tablet" }],
        },
        prompt: {
          all: [{ type: "record_revealed", recordKey: "clue_tablet" }],
        },
      },
    });

    const before = await searchKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: "branch-main",
      request: {
        textQuery: "catacomb secret",
        limit: 10,
      },
    });

    const beforeHit = before.hits.find((item) => item.recordId === hidden.id);
    expect(beforeHit?.visibility).toBe("preview");
    expect(beforeHit?.record).toBeNull();
    expect(beforeHit?.preview.title).toBe("Catacomb Secret");

    const failedReveal = await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: "branch-main",
      request: {
        recordIds: [hidden.id],
        reason: "premature",
        revealedBy: "llm",
      },
    });

    expect(failedReveal.results[0]).toMatchObject({
      recordId: hidden.id,
      status: "blocked",
    });

    await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: "branch-main",
      request: {
        recordIds: [clue.id],
        reason: "found tablet",
        revealedBy: "system",
        context: {
          manualUnlock: true,
        },
      },
    });

    const successfulReveal = await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: "branch-main",
      request: {
        recordIds: [hidden.id],
        reason: "clue chain satisfied",
        revealedBy: "system",
      },
    });

    expect(successfulReveal.results[0]).toMatchObject({
      recordId: hidden.id,
      status: "revealed",
    });

    const after = await searchKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-reveal",
      branchId: "branch-main",
      request: {
        textQuery: "catacomb secret",
        limit: 10,
      },
    });

    const afterHit = after.hits.find((item) => item.recordId === hidden.id);
    expect(afterHit?.visibility).toBe("full");
    expect(afterHit?.record?.content).toEqual({ spoiler: "The king's remains are hidden there." });

    const persisted = await getKnowledgeRecordById(hidden.id);
    expect(persisted?.content).toEqual({ spoiler: "The king's remains are hidden there." });
  });

  test("reveal supports flag_equals context predicate", async () => {
    await seedChatScope({ chatId: "chat-flags", branchIds: ["branch-flags"] });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-flags",
      branchId: null,
      scope: "chat",
      name: "Flags Pack",
      kind: "scenario",
      layer: "baseline",
      origin: "author",
    });

    const record = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-flags",
      branchId: null,
      collectionId: collection.id,
      recordType: "fact",
      key: "vault_code",
      title: "Vault Code",
      aliases: [],
      tags: ["vault"],
      summary: "The code is written under the altar",
      content: { code: "8132" },
      accessMode: "discoverable",
      layer: "baseline",
      origin: "author",
      gatePolicy: {
        read: {
          all: [{ type: "flag_equals", key: "quest.has_map", value: true }],
        },
      },
    });

    const blocked = await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-flags",
      branchId: "branch-flags",
      request: {
        recordIds: [record.id],
        reason: "missing flag",
        revealedBy: "llm",
        context: {
          flags: {
            "quest.has_map": false,
          },
        },
      },
    });

    expect(blocked.results[0]?.status).toBe("blocked");

    const allowed = await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-flags",
      branchId: "branch-flags",
      request: {
        recordIds: [record.id],
        reason: "flag set",
        revealedBy: "system",
        context: {
          flags: {
            "quest.has_map": true,
          },
        },
      },
    });

    expect(allowed.results[0]?.status).toBe("revealed");
  });

  test("branch overlay does not leak branch-scoped records into sibling branch", async () => {
    await seedChatScope({ chatId: "chat-branches", branchIds: ["branch-a", "branch-b"] });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-branches",
      branchId: null,
      scope: "chat",
      name: "Branch Pack",
      kind: "scenario",
      layer: "baseline",
      origin: "author",
    });

    await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-branches",
      branchId: "branch-a",
      collectionId: collection.id,
      recordType: "note",
      key: "branch_a_note",
      title: "Branch A Note",
      aliases: [],
      tags: ["branch"],
      summary: "Only branch A should see this",
      content: { note: "A only" },
      accessMode: "public",
      layer: "runtime",
      origin: "llm",
    });

    const branchA = await searchKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-branches",
      branchId: "branch-a",
      request: {
        textQuery: "branch a note",
        limit: 10,
      },
    });
    expect(branchA.hits.some((item) => item.record?.key === "branch_a_note")).toBe(true);

    const branchB = await searchKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-branches",
      branchId: "branch-b",
      request: {
        textQuery: "branch a note",
        limit: 10,
      },
    });
    expect(branchB.hits.some((item) => item.record?.key === "branch_a_note")).toBe(false);
  });

  test("does not add records to another owner's collection", async () => {
    const firstOwner = "11111111-1111-4111-8111-111111111111";
    const secondOwner = "22222222-2222-4222-8222-222222222222";
    await runWithOwnerScope(firstOwner, () =>
      seedChatScope({ ownerId: firstOwner, chatId: "private-chat" })
    );
    const collection = await runWithOwnerScope(firstOwner, () =>
      createKnowledgeCollection({
        chatId: "private-chat",
        branchId: null,
        scope: "chat",
        name: "Private collection",
        origin: "author",
        layer: "baseline",
      })
    );

    await expect(
      runWithOwnerScope(secondOwner, () =>
        upsertKnowledgeRecord({
          ownerId: firstOwner,
          chatId: "private-chat",
          branchId: null,
          collectionId: collection.id,
          recordType: "note",
          key: "cross_owner",
          title: "Cross owner",
          aliases: [],
          tags: [],
          content: { text: "forbidden" },
          accessMode: "public",
          layer: "runtime",
          origin: "llm",
        })
      )
    ).rejects.toThrow("Knowledge collection not found");
  });

  test("export/import support baseline and runtime filtering", async () => {
    await seedChatScope({
      chatId: "chat-export",
      branchIds: ["branch-export"],
    });
    await seedChatScope({ chatId: "chat-imported" });

    const collection = await createKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-export",
      branchId: null,
      scope: "chat",
      name: "Export Pack",
      kind: "scenario",
      layer: "baseline",
      origin: "import",
    });

    const baseline = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-export",
      branchId: null,
      collectionId: collection.id,
      recordType: "location",
      key: "city",
      title: "Old City",
      aliases: [],
      tags: ["city"],
      summary: "Original city record",
      content: { text: "Baseline city." },
      accessMode: "public",
      layer: "baseline",
      origin: "import",
    });

    const runtime = await upsertKnowledgeRecord({
      ownerId: "global",
      chatId: "chat-export",
      branchId: null,
      collectionId: collection.id,
      recordType: "note",
      key: "runtime_note",
      title: "Runtime Note",
      aliases: [],
      tags: ["note"],
      summary: "Created in play",
      content: { text: "Runtime note." },
      accessMode: "public",
      layer: "runtime",
      origin: "llm",
      derivedFromRecordId: baseline.id,
    });

    await revealKnowledgeRecords({
      ownerId: "global",
      chatId: "chat-export",
      branchId: "branch-export",
      request: {
        recordIds: [baseline.id],
        revealedBy: "system",
        reason: "baseline reveal",
        context: { manualUnlock: true },
      },
    });

    const baselineOnly = await exportKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-export",
      branchId: "branch-export",
      collectionId: collection.id,
      mode: "baseline_only",
    });
    expect(baselineOnly.records.map((item) => item.key)).toEqual(["city"]);

    const runtimeOnly = await exportKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-export",
      branchId: "branch-export",
      collectionId: collection.id,
      mode: "runtime_only",
    });
    expect(runtimeOnly.records.map((item) => item.key)).toEqual(["runtime_note"]);

    const baselineWithReveals = await exportKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-export",
      branchId: "branch-export",
      collectionId: collection.id,
      mode: "baseline_with_reveals",
    });
    expect(baselineWithReveals.records.map((item) => item.key)).toEqual(["city"]);
    expect(baselineWithReveals.accessState).toHaveLength(1);

    const imported = await importKnowledgeCollection({
      ownerId: "global",
      chatId: "chat-imported",
      branchId: null,
      payload: baselineOnly,
    });

    const collections = await listKnowledgeCollections({
      ownerId: "global",
      chatId: "chat-imported",
      branchId: null,
    });

    expect(imported.collection.id).toBeTruthy();
    expect(collections.map((item) => item.name)).toContain("Export Pack");
    expect(imported.records).toHaveLength(1);
    expect(imported.records[0]?.key).toBe("city");

    expect(runtime.id).toBeTruthy();
  });
});
