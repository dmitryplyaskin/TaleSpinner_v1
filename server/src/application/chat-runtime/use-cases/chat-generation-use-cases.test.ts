import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildInstructionRenderContext: vi.fn(),
  resolveAndApplyWorldInfoToTemplateContext: vi.fn(),
  getSelectedUserPerson: vi.fn(),
  runChatGenerationV3: vi.fn(),
  getGenerationByIdWithDebug: vi.fn(),
}));

vi.mock("../../../services/chat-core/prompt-template-context", () => ({
  buildInstructionRenderContext: mocks.buildInstructionRenderContext,
  resolveAndApplyWorldInfoToTemplateContext: mocks.resolveAndApplyWorldInfoToTemplateContext,
}));

vi.mock("../../../services/chat-core/user-persons-repository", () => ({
  getSelectedUserPerson: mocks.getSelectedUserPerson,
}));

vi.mock("../../../services/chat-generation-v3/run-chat-generation-v3", () => ({
  runChatGenerationV3: mocks.runChatGenerationV3,
}));

vi.mock("../../../services/chat-core/generations-repository", async () => {
  const actual = await vi.importActual<object>("../../../services/chat-core/generations-repository");
  return {
    ...actual,
    getGenerationByIdWithDebug: mocks.getGenerationByIdWithDebug,
  };
});

import { applyMigrations } from "../../../db/apply-migrations";
import { resetDbForTests, initDb } from "../../../db/client";
import { chatBranches, chatEntries, chats, entityProfiles, entryVariants, variantParts } from "../../../db/schema";
import { createTempDataDir, removeTempDataDir } from "../../../e2e/helpers/tmp-dir";
import { createEntryWithVariant } from "../../../services/chat-entry-parts/entries-repository";
import * as partsRepository from "../../../services/chat-entry-parts/parts-repository";
import { listEntryVariants } from "../../../services/chat-entry-parts/variants-repository";

import { continueGeneration } from "./continue-generation";
import { createEntryAndStartGeneration } from "./create-entry-and-start-generation";
import { regenerateAssistantVariant } from "./regenerate-assistant-variant";

import type { RunEvent } from "../../../services/chat-generation-v3/contracts";

type TestChatFixture = {
  entityProfileId: string;
  chatId: string;
  branchId: string;
};

let tempDir: string;
let dbPath: string;

function makeContext() {
  return {
    char: {},
    user: { name: "Alice" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-03-05T10:00:00.000Z").toISOString(),
  };
}

function makeRunEvents(generationId: string): AsyncGenerator<RunEvent> {
  return (async function* () {
    yield {
      runId: generationId,
      seq: 1,
      type: "run.started",
      data: {
        generationId,
        trigger: "generate",
      },
    } as RunEvent;
    yield {
      runId: generationId,
      seq: 2,
      type: "run.finished",
      data: {
        generationId,
        status: "done",
        failedType: null,
      },
    } as RunEvent;
  })();
}

async function seedChatFixture(): Promise<TestChatFixture> {
  const db = await initDb();
  const entityProfileId = "entity-1";
  const chatId = "chat-1";
  const branchId = "branch-1";
  const ts = new Date("2026-03-05T10:00:00.000Z");

  db.insert(entityProfiles)
    .values({
      id: entityProfileId,
      ownerId: "global",
      name: "Test Entity",
      kind: "CharSpec",
      specJson: "{}",
      metaJson: null,
      isFavorite: false,
      createdAt: ts,
      updatedAt: ts,
      avatarAssetId: null,
    })
    .run();

  db.insert(chats)
    .values({
      id: chatId,
      ownerId: "global",
      entityProfileId,
      title: "Test Chat",
      activeBranchId: branchId,
      instructionId: null,
      status: "active",
      createdAt: ts,
      updatedAt: ts,
      lastMessageAt: null,
      lastMessagePreview: null,
      version: 0,
      metaJson: null,
      originChatId: null,
      originBranchId: null,
      originMessageId: null,
    })
    .run();

  db.insert(chatBranches)
    .values({
      id: branchId,
      ownerId: "global",
      chatId,
      title: "main",
      createdAt: ts,
      updatedAt: ts,
      parentBranchId: null,
      forkedFromMessageId: null,
      forkedFromVariantId: null,
      metaJson: null,
      currentTurn: 0,
    })
    .run();

  return { entityProfileId, chatId, branchId };
}

async function collectEvents(events: AsyncGenerator<RunEvent>): Promise<RunEvent[]> {
  const out: RunEvent[] = [];
  for await (const event of events) {
    out.push(event);
  }
  return out;
}

beforeEach(async () => {
  vi.clearAllMocks();

  tempDir = await createTempDataDir("talespinner-use-cases-");
  dbPath = path.join(tempDir, "test.db");
  await initDb({ dbPath });
  await applyMigrations();

  mocks.buildInstructionRenderContext.mockResolvedValue(makeContext());
  mocks.resolveAndApplyWorldInfoToTemplateContext.mockResolvedValue(undefined);
  mocks.getSelectedUserPerson.mockResolvedValue(null);
  mocks.getGenerationByIdWithDebug.mockResolvedValue({
    id: "gen-1",
    chatId: "chat-1",
    branchId: "branch-1",
    messageId: null,
    variantId: null,
    status: "done",
    startedAt: new Date("2026-03-05T10:00:00.000Z"),
    finishedAt: new Date("2026-03-05T10:00:01.000Z"),
    error: null,
    promptHash: "hash-1",
    promptSnapshot: null,
    debug: null,
  });
  mocks.runChatGenerationV3.mockImplementation(() => makeRunEvents("gen-1"));
});

afterEach(async () => {
  resetDbForTests();
  await removeTempDataDir(tempDir);
});

describe("chat generation application use cases", () => {
  test("createEntryAndStartGeneration returns session metadata and links the finished generation", async () => {
    const fixture = await seedChatFixture();

    const session = await createEntryAndStartGeneration({
      chatId: fixture.chatId,
      body: {
        role: "user",
        content: "Hello there",
        settings: {},
        requestId: "req-create-1",
      },
      abortController: new AbortController(),
    });

    expect(session.envBase.chatId).toBe(fixture.chatId);
    expect(session.envBase.branchId).toBe(fixture.branchId);
    expect(session.envBase.userEntryId).toBeTruthy();
    expect(session.envBase.assistantEntryId).toBeTruthy();
    expect(session.envBase.assistantVariantId).toBeTruthy();

    const events = await collectEvents(session.events);
    expect(events.map((event) => event.type)).toEqual(["run.started", "run.finished"]);

    const variants = await listEntryVariants({ entryId: String(session.envBase.assistantEntryId) });
    const generated = variants.find(
      (variant) => variant.variantId === session.envBase.assistantVariantId
    );
    expect(generated?.derived).toEqual({
      generationId: "gen-1",
      promptHash: "hash-1",
    });
  });

  test("createEntryAndStartGeneration removes empty assistant scaffolding on preparation failure", async () => {
    const fixture = await seedChatFixture();
    mocks.runChatGenerationV3.mockImplementationOnce(async function* () {
      yield {
        runId: "request-prepare-failure",
        seq: 1,
        type: "run.preparation_failed",
        data: {
          generationId: null,
          status: "error",
          code: "generation_preparation_error",
          message: "profile compilation failed",
        },
      } as RunEvent;
    });

    const session = await createEntryAndStartGeneration({
      chatId: fixture.chatId,
      body: {
        role: "user",
        content: "Hello there",
        settings: {},
        requestId: "request-prepare-failure",
      },
    });

    await collectEvents(session.events);
    const db = await initDb();
    const assistantRows = await db
      .select({ softDeleted: chatEntries.softDeleted })
      .from(chatEntries)
      .where(eq(chatEntries.entryId, String(session.envBase.assistantEntryId)));

    expect(assistantRows[0]?.softDeleted).toBe(true);
  });

  test("continueGeneration returns session metadata for the latest user turn", async () => {
    const fixture = await seedChatFixture();
    const user = await createEntryWithVariant({
      chatId: fixture.chatId,
      branchId: fixture.branchId,
      role: "user",
      variantKind: "manual_edit",
    });
    await partsRepository.createPart({
      variantId: user.variant.variantId,
      channel: "main",
      order: 0,
      payload: "Continue from here",
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: 0,
      source: "user",
    });

    const session = await continueGeneration({
      chatId: fixture.chatId,
      body: {
        settings: {},
        requestId: "req-continue-1",
      },
      abortController: new AbortController(),
    });

    expect(session.envBase.userEntryId).toBe(user.entry.entryId);
    expect(session.envBase.userMainPartId).toBeTruthy();
    expect(session.envBase.assistantEntryId).toBeTruthy();
    await collectEvents(session.events);

    const variants = await listEntryVariants({ entryId: String(session.envBase.assistantEntryId) });
    expect(variants[0]?.derived).toEqual({
      generationId: "gen-1",
      promptHash: "hash-1",
    });
  });

  test("regenerateAssistantVariant cleans up the empty generation variant after the stream finishes", async () => {
    const fixture = await seedChatFixture();
    const user = await createEntryWithVariant({
      chatId: fixture.chatId,
      branchId: fixture.branchId,
      role: "user",
      variantKind: "manual_edit",
    });
    await partsRepository.createPart({
      variantId: user.variant.variantId,
      channel: "main",
      order: 0,
      payload: "Need another version",
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: 0,
      source: "user",
    });

    const assistant = await createEntryWithVariant({
      chatId: fixture.chatId,
      branchId: fixture.branchId,
      role: "assistant",
      variantKind: "generation",
    });
    await partsRepository.createPart({
      variantId: assistant.variant.variantId,
      channel: "main",
      order: 0,
      payload: "Original answer",
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: 1,
      source: "llm",
    });

    const session = await regenerateAssistantVariant({
      entryId: assistant.entry.entryId,
      body: {
        settings: {},
        requestId: "req-regen-1",
      },
      abortController: new AbortController(),
    });

    await collectEvents(session.events);

    const variants = await listEntryVariants({ entryId: assistant.entry.entryId });
    expect(variants).toHaveLength(1);
    expect(variants[0]?.variantId).toBe(assistant.variant.variantId);
    expect(variants[0]?.parts.some((part) => String(part.payload ?? "").trim().length === 0)).toBe(
      false
    );
  });

  test("createEntryAndStartGeneration rolls back scaffolding when a transactional write fails", async () => {
    const fixture = await seedChatFixture();
    const originalCreatePart = partsRepository.createPart;
    let calls = 0;

    const spy = vi
      .spyOn(partsRepository, "createPart")
      .mockImplementation(((params: Parameters<typeof partsRepository.createPart>[0]) => {
        calls += 1;
        if (calls === 2) {
          throw new Error("forced createPart failure");
        }
        return originalCreatePart(params as never) as never;
      }) as typeof partsRepository.createPart);

    await expect(
      createEntryAndStartGeneration({
        chatId: fixture.chatId,
        body: {
          role: "user",
          content: "Rollback me",
          settings: {},
        },
        abortController: new AbortController(),
      })
    ).rejects.toThrow("forced createPart failure");

    spy.mockRestore();

    const db = await initDb();
    const entryRows = db
      .select()
      .from(chatEntries)
      .where(eq(chatEntries.chatId, fixture.chatId))
      .all();
    const variantRows = db
      .select()
      .from(entryVariants)
      .all();
    const partRows = db
      .select()
      .from(variantParts)
      .all();
    const branchRow = db
      .select({ currentTurn: chatBranches.currentTurn })
      .from(chatBranches)
      .where(eq(chatBranches.id, fixture.branchId))
      .limit(1)
      .all()[0];

    expect(entryRows).toHaveLength(0);
    expect(variantRows).toHaveLength(0);
    expect(partRows).toHaveLength(0);
    expect(branchRow?.currentTurn).toBe(0);
  });
});
