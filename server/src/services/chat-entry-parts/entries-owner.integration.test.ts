import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "../../core/request-context/owner-scope-storage";
import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import {
  chatBranches,
  chatEntries,
  chats,
  entityProfiles,
} from "../../db/schema";
import {
  createTempDataDir,
  removeTempDataDir,
} from "../../e2e/helpers/tmp-dir";

import { softDeleteEntries } from "./entries-repository";

let tempDir = "";

async function seedOwnerEntry(ownerId: string): Promise<string> {
  const db = await initDb();
  const now = new Date("2026-07-27T10:00:00.000Z");
  const entityId = `entity-${ownerId}`;
  const chatId = `chat-${ownerId}`;
  const branchId = `branch-${ownerId}`;
  const entryId = `entry-${ownerId}`;

  await db.insert(entityProfiles).values({
    id: entityId,
    ownerId,
    name: ownerId,
    kind: "CharSpec",
    specJson: "{}",
    metaJson: null,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    avatarAssetId: null,
  });
  await db.insert(chats).values({
    id: chatId,
    ownerId,
    entityProfileId: entityId,
    title: ownerId,
    activeBranchId: branchId,
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
  await db.insert(chatBranches).values({
    id: branchId,
    ownerId,
    chatId,
    title: null,
    createdAt: now,
    updatedAt: now,
    parentBranchId: null,
    forkedFromMessageId: null,
    forkedFromVariantId: null,
    metaJson: null,
    currentTurn: 0,
  });
  await db.insert(chatEntries).values({
    entryId,
    ownerId,
    chatId,
    branchId,
    role: "user",
    createdAt: now,
    activeVariantId: `variant-${ownerId}`,
    softDeleted: false,
    softDeletedAt: null,
    softDeletedBy: null,
    metaJson: null,
  });

  return entryId;
}

describe("chat entry owner isolation", () => {
  beforeEach(async () => {
    resetDbForTests();
    tempDir = await createTempDataDir("entries-owner-");
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await removeTempDataDir(tempDir);
  });

  test("bulk soft delete only mutates entries owned by the active account", async () => {
    const firstEntryId = await seedOwnerEntry("owner-a");
    const secondEntryId = await seedOwnerEntry("owner-b");

    const changed = await runWithOwnerScope("owner-b", () =>
      softDeleteEntries({
        entryIds: [firstEntryId, secondEntryId],
        by: "user",
      })
    );

    expect(changed).toEqual([secondEntryId]);
    const rows = await (await initDb()).select().from(chatEntries);
    expect(
      Object.fromEntries(rows.map((row) => [row.entryId, row.softDeleted]))
    ).toEqual({
      [firstEntryId]: false,
      [secondEntryId]: true,
    });
  });
});
