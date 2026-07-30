import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { bootstrapApp, createApp } from "../app";
import { initDb, resetDbForTests } from "../db/client";
import { chatBranches, chats, entityProfiles } from "../db/schema";

import type { Server } from "node:http";

async function startServer() {
  resetDbForTests();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-knowledge-api-"));
  const dbPath = path.join(tempDir, "db.sqlite");
  await bootstrapApp({ dbPath });
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    tempDir,
    server,
  };
}

async function stopServer(server: Server, tempDir: string) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  resetDbForTests();
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function setupLocalAccount(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "" }),
  });
  expect(response.status).toBe(201);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Auth setup did not return a session cookie");
  return setCookie.split(";")[0];
}

async function seedChatScope(params: { chatId: string; branchId: string }) {
  const db = await initDb();
  const now = new Date();
  const entityProfileId = `entity:${params.chatId}`;

  await db.insert(entityProfiles).values({
    id: entityProfileId,
    ownerId: "global",
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
    ownerId: "global",
    entityProfileId,
    title: `Chat ${params.chatId}`,
    activeBranchId: params.branchId,
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
    id: params.branchId,
    ownerId: "global",
    chatId: params.chatId,
    title: params.branchId,
    createdAt: now,
    updatedAt: now,
    parentBranchId: null,
    forkedFromMessageId: null,
    forkedFromVariantId: null,
    metaJson: null,
    currentTurn: 0,
  });
}

describe("chat knowledge api", () => {
  afterEach(() => {
    resetDbForTests();
  });

  test("creates records, searches previews, and reveals through HTTP routes", async () => {
    const started = await startServer();
    try {
      const cookie = await setupLocalAccount(started.baseUrl);
      await seedChatScope({ chatId: "chat-api", branchId: "branch-api" });

      const collectionResponse = await fetch(`${started.baseUrl}/api/chat-knowledge/collections`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          chatId: "chat-api",
          branchId: null,
          scope: "chat",
          name: "API Pack",
          kind: "scenario",
          origin: "author",
          layer: "baseline",
        }),
      });
      expect(collectionResponse.status).toBe(200);
      const collectionBody = (await collectionResponse.json()) as { data: { id: string } };

      const recordResponse = await fetch(`${started.baseUrl}/api/chat-knowledge/records`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          chatId: "chat-api",
          branchId: null,
          collectionId: collectionBody.data.id,
          recordType: "fact",
          key: "sealed_room",
          title: "Sealed Room",
          aliases: [],
          tags: ["secret"],
          summary: "A hidden room under the manor",
          content: { text: "The sealed room contains the evidence." },
          accessMode: "discoverable",
          origin: "author",
          layer: "baseline",
          gatePolicy: {
            read: {
              all: [{ type: "manual_unlock" }],
            },
          },
        }),
      });
      expect(recordResponse.status).toBe(200);
      const recordBody = (await recordResponse.json()) as { data: { id: string } };

      const searchBefore = await fetch(`${started.baseUrl}/api/chat-knowledge/records/search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          chatId: "chat-api",
          branchId: "branch-api",
          request: {
            textQuery: "sealed room",
            limit: 5,
          },
        }),
      });
      expect(searchBefore.status).toBe(200);
      const searchBeforeBody = (await searchBefore.json()) as {
        data: { hits: Array<{ visibility: string; record: unknown }> };
      };
      expect(searchBeforeBody.data.hits[0]?.visibility).toBe("preview");
      expect(searchBeforeBody.data.hits[0]?.record).toBeNull();

      const revealResponse = await fetch(`${started.baseUrl}/api/chat-knowledge/reveal`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          chatId: "chat-api",
          branchId: "branch-api",
          request: {
            recordIds: [recordBody.data.id],
            revealedBy: "system",
            reason: "manual unlock",
            context: {
              manualUnlock: true,
            },
          },
        }),
      });
      expect(revealResponse.status).toBe(200);

      const searchAfter = await fetch(`${started.baseUrl}/api/chat-knowledge/records/search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          chatId: "chat-api",
          branchId: "branch-api",
          request: {
            textQuery: "sealed room",
            limit: 5,
          },
        }),
      });
      const searchAfterBody = (await searchAfter.json()) as {
        data: { hits: Array<{ visibility: string; record: { key: string } | null }> };
      };
      expect(searchAfter.status).toBe(200);
      expect(searchAfterBody.data.hits[0]?.visibility).toBe("full");
      expect(searchAfterBody.data.hits[0]?.record?.key).toBe("sealed_room");
    } finally {
      await stopServer(started.server, started.tempDir);
    }
  });
});
