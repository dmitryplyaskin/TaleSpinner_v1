import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "@core/request-context/owner-scope-storage";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";

import {
  createAssistantMessageWithVariant,
  createChat,
  createChatBranch,
  getChatById,
  listChatBranches,
  listChatMessages,
  setChatInstruction,
  softDeleteChat,
  updateAssistantText,
  updateChatTitle,
} from "./chats-repository";
import { createEntityProfile } from "./entity-profiles-repository";
import { createInstruction } from "./instructions-repository";

const FIRST_OWNER = "11111111-1111-4111-8111-111111111111";
const SECOND_OWNER = "22222222-2222-4222-8222-222222222222";

describe("legacy chat repository owner scope", () => {
  let tempDir = "";

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-owner-"));
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("prevents cross-owner chat, branch, and message mutations", async () => {
    const profile = await runWithOwnerScope(FIRST_OWNER, () =>
      createEntityProfile({
        name: "Private character",
        kind: "CharSpec",
        spec: { name: "Private character" },
      })
    );
    const created = await runWithOwnerScope(FIRST_OWNER, () =>
      createChat({
        entityProfileId: profile.id,
        title: "Private chat",
      })
    );
    const assistant = await runWithOwnerScope(FIRST_OWNER, () =>
      createAssistantMessageWithVariant({
        chatId: created.chat.id,
        branchId: created.mainBranch.id,
      })
    );

    await runWithOwnerScope(SECOND_OWNER, () =>
      updateChatTitle({ chatId: created.chat.id, title: "Stolen" })
    );
    await runWithOwnerScope(SECOND_OWNER, () => softDeleteChat(created.chat.id));
    await expect(
      runWithOwnerScope(SECOND_OWNER, () =>
        createChatBranch({ chatId: created.chat.id, title: "Injected" })
      )
    ).rejects.toThrow("Chat не найден");
    await runWithOwnerScope(SECOND_OWNER, () =>
      updateAssistantText({
        assistantMessageId: assistant.assistantMessageId,
        variantId: assistant.variantId,
        text: "Stolen",
      })
    );

    await expect(
      runWithOwnerScope(SECOND_OWNER, () => getChatById(created.chat.id))
    ).resolves.toBeNull();
    await expect(
      runWithOwnerScope(SECOND_OWNER, () =>
        listChatBranches({ chatId: created.chat.id })
      )
    ).resolves.toEqual([]);

    const original = await runWithOwnerScope(FIRST_OWNER, () =>
      getChatById(created.chat.id)
    );
    expect(original).toMatchObject({ title: "Private chat", status: "active" });
    const messages = await runWithOwnerScope(FIRST_OWNER, () =>
      listChatMessages({
        chatId: created.chat.id,
        branchId: created.mainBranch.id,
        limit: 10,
      })
    );
    expect(messages[0]).toMatchObject({ promptText: "" });
  });

  test("does not create a chat for another owner's entity profile", async () => {
    const profile = await runWithOwnerScope(FIRST_OWNER, () =>
      createEntityProfile({
        name: "Private character",
        kind: "CharSpec",
        spec: { name: "Private character" },
      })
    );

    await expect(
      runWithOwnerScope(SECOND_OWNER, () =>
        createChat({ entityProfileId: profile.id, title: "Cross owner" })
      )
    ).rejects.toThrow("EntityProfile не найден");
  });

  test("does not attach another owner's instruction to a chat", async () => {
    const profile = await runWithOwnerScope(FIRST_OWNER, () =>
      createEntityProfile({
        name: "Private character",
        kind: "CharSpec",
        spec: { name: "Private character" },
      })
    );
    const created = await runWithOwnerScope(FIRST_OWNER, () =>
      createChat({ entityProfileId: profile.id, title: "Private chat" })
    );
    const foreignInstruction = await runWithOwnerScope(SECOND_OWNER, () =>
      createInstruction({
        name: "Foreign instruction",
        kind: "basic",
        templateText: "Do not expose",
      })
    );

    await expect(
      runWithOwnerScope(FIRST_OWNER, () =>
        setChatInstruction({
          chatId: created.chat.id,
          instructionId: foreignInstruction.id,
        })
      )
    ).rejects.toThrow("Instruction не найдена");

    const chat = await runWithOwnerScope(FIRST_OWNER, () =>
      getChatById(created.chat.id)
    );
    expect(chat?.instructionId).toBeNull();
  });
});
