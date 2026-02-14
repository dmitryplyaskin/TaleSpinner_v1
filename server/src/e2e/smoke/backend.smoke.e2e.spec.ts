import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestDb } from "../helpers/db";
import { configureLlmOpenAiCompatible, createEntityProfileAndChat } from "../helpers/fixtures";
import { collectSse, requestForm, requestJson, type SseEvent } from "../helpers/http";
import { startMockAiServer, type RunningMockAiServer } from "../helpers/mock-ai-server";
import { startInProcessServer, type RunningServer } from "../helpers/test-server";
import { createTempDataDir, removeTempDataDir } from "../helpers/tmp-dir";

type ApiEnvelope<T> = { data: T };

function eventPayload<T>(event: SseEvent): T {
  const raw = event.data as { data?: unknown } | null;
  return (raw?.data ?? raw) as T;
}

function findEvent(events: SseEvent[], eventName: string): SseEvent {
  const found = events.find((event) => event.event === eventName);
  if (!found) {
    throw new Error(`SSE event not found: ${eventName}`);
  }
  return found;
}

describe("backend e2e smoke", () => {
  let dataDir = "";
  let appServer: RunningServer | null = null;
  let mockAiServer: RunningMockAiServer | null = null;
  let db: TestDb | null = null;

  beforeAll(async () => {
    dataDir = await createTempDataDir();
    mockAiServer = await startMockAiServer();
    appServer = await startInProcessServer({
      dataDir,
      tokensMasterKey: "e2e-master-key-0123456789",
    });
    db = new TestDb(dataDir);
  });

  afterAll(async () => {
    db?.close();
    await appServer?.close();
    await mockAiServer?.close();
    await removeTempDataDir(dataDir);
  });

  test("chat generation spine persists DB artifacts and generation link", async () => {
    const baseUrl = appServer!.baseUrl;
    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "success_text_stream",
      token: "tok_success",
    });

    const { chatId } = await createEntityProfileAndChat({ baseUrl, name: "Spine Profile" });

    const events = await collectSse({
      baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "Hello from smoke",
        settings: {},
      },
      stopWhen: (event) => event.event === "llm.stream.done",
    });

    const metaPayload = eventPayload<{
      generationId: string;
      assistantEntryId: string;
      assistantVariantId: string;
      assistantMainPartId: string;
    }>(findEvent(events, "llm.stream.meta"));
    const donePayload = eventPayload<{ status: string }>(findEvent(events, "llm.stream.done"));

    expect(donePayload.status).toBe("done");

    const generationRow = db!.get<{ status: string }>(
      "select status from llm_generations where id = ?",
      [metaPayload.generationId]
    );
    expect(generationRow?.status).toBe("done");

    const entryRow = db!.get<{ entry_id: string }>(
      "select entry_id from chat_entries where entry_id = ?",
      [metaPayload.assistantEntryId]
    );
    expect(entryRow?.entry_id).toBe(metaPayload.assistantEntryId);

    const partRow = db!.get<{ payload_json: string }>(
      "select payload_json from variant_parts where part_id = ?",
      [metaPayload.assistantMainPartId]
    );
    expect(partRow).toBeDefined();
    const payload = JSON.parse(String(partRow!.payload_json)) as { value?: string };
    expect(String(payload.value ?? "")).toContain("hello world");

    const derivedRow = db!.get<{ derived_json: string | null }>(
      "select derived_json from entry_variants where variant_id = ?",
      [metaPayload.assistantVariantId]
    );
    const derived = JSON.parse(String(derivedRow?.derived_json ?? "{}")) as {
      generationId?: string;
    };
    expect(derived.generationId).toBe(metaPayload.generationId);
  });

  test("regenerate keeps variants healthy and removes empty generation variants", async () => {
    const baseUrl = appServer!.baseUrl;
    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "success_text_stream",
      token: "tok_regen_seed",
    });

    const { chatId } = await createEntityProfileAndChat({ baseUrl, name: "Regen Profile" });

    const initialEvents = await collectSse({
      baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "Need regenerate",
        settings: {},
      },
      stopWhen: (event) => event.event === "llm.stream.done",
    });
    const initialMeta = eventPayload<{ assistantEntryId: string }>(findEvent(initialEvents, "llm.stream.meta"));

    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "empty_done",
      token: "tok_regen_empty",
    });

    await collectSse({
      baseUrl,
      path: `/api/entries/${initialMeta.assistantEntryId}/regenerate`,
      body: { settings: {} },
      stopWhen: (event) => event.event === "llm.stream.done",
    });

    const variantsRes = await requestJson<ApiEnvelope<Array<{ kind: string; parts: Array<{ payload: unknown }> }>>>({
      baseUrl,
      method: "GET",
      path: `/api/entries/${initialMeta.assistantEntryId}/variants`,
    });
    expect(variantsRes.status).toBe(200);

    const emptyGenerationVariant = variantsRes.data.data.find(
      (variant) =>
        variant.kind === "generation" &&
        variant.parts.length > 0 &&
        variant.parts.every((part) => String(part.payload ?? "").trim().length === 0)
    );
    expect(emptyGenerationVariant).toBeUndefined();
  });

  test("abort endpoint stops generation and persists aborted status", async () => {
    const baseUrl = appServer!.baseUrl;
    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "slow_stream",
      token: "tok_abort",
    });

    const { chatId } = await createEntityProfileAndChat({ baseUrl, name: "Abort Profile" });

    let abortedGenerationId: string | null = null;
    let abortCalled = false;

    const events = await collectSse({
      baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "Please abort",
        settings: {},
      },
      onEvent: async (event) => {
        if (abortCalled || event.event !== "run.started") return;
        const payload = eventPayload<{ generationId: string }>(event);
        abortedGenerationId = payload.generationId;
        abortCalled = true;
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/generations/${payload.generationId}/abort`,
        });
      },
      stopWhen: (event) => event.event === "llm.stream.done",
      timeoutMs: 45_000,
    });

    expect(abortedGenerationId).toBeTruthy();
    const donePayload = eventPayload<{ status: string }>(findEvent(events, "llm.stream.done"));
    expect(donePayload.status).toBe("aborted");
    const generationId = abortedGenerationId;
    if (!generationId) {
      throw new Error("generation id was not captured for abort test");
    }

    const generationRow = db!.get<{ status: string }>(
      "select status from llm_generations where id = ?",
      [generationId]
    );
    expect(generationRow?.status).toBe("aborted");
  });

  test("token fallback switches token after first pre-stream failure", async () => {
    const baseUrl = appServer!.baseUrl;

    const failTokenRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/llm/tokens",
      body: {
        providerId: "openai_compatible",
        name: "fallback-fail",
        token: "tok_fail",
      },
    });
    const okTokenRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/llm/tokens",
      body: {
        providerId: "openai_compatible",
        name: "fallback-ok",
        token: "tok_ok",
      },
    });
    expect(failTokenRes.status).toBe(200);
    expect(okTokenRes.status).toBe(200);

    const configRes = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/llm/providers/openai_compatible/config",
      body: {
        baseUrl: `${mockAiServer!.baseUrl}/v1`,
        defaultModel: "fallback_token_first_fails_second_succeeds",
        tokenPolicy: { fallbackOnError: true, randomize: false },
      },
    });
    expect(configRes.status).toBe(200);

    const runtimeRes = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/llm/runtime",
      body: {
        scope: "global",
        scopeId: "global",
        activeProviderId: "openai_compatible",
        activeTokenId: failTokenRes.data.data.id,
        activeModel: "fallback_token_first_fails_second_succeeds",
      },
    });
    expect(runtimeRes.status).toBe(200);

    const { chatId } = await createEntityProfileAndChat({ baseUrl, name: "Fallback Profile" });
    const events = await collectSse({
      baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "Fallback run",
        settings: {},
      },
      stopWhen: (event) => event.event === "llm.stream.done",
    });

    const deltaEvents = events.filter((event) => event.event === "llm.stream.delta");
    expect(deltaEvents.length).toBeGreaterThan(0);
    const combined = deltaEvents
      .map((event) => eventPayload<{ content: string }>(event).content ?? "")
      .join("");
    expect(combined).toContain("hello world");

    const donePayload = eventPayload<{ status: string }>(findEvent(events, "llm.stream.done"));
    expect(donePayload.status).toBe("done");
  });

  test("llm lifecycle + rag + world-info + files smoke", async () => {
    const baseUrl = appServer!.baseUrl;

    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "success_text_stream",
      token: "tok_smoke_misc",
    });

    const providersRes = await requestJson<ApiEnvelope<{ providers: unknown[] }>>({
      baseUrl,
      method: "GET",
      path: "/api/llm/providers",
    });
    expect(providersRes.status).toBe(200);
    expect(Array.isArray(providersRes.data.data.providers)).toBe(true);

    const modelsRes = await requestJson<ApiEnvelope<{ models: Array<{ id: string }> }>>({
      baseUrl,
      method: "GET",
      path: "/api/llm/models?providerId=openai_compatible&scope=global&scopeId=global",
    });
    expect(modelsRes.status).toBe(200);
    expect(modelsRes.data.data.models.length).toBeGreaterThan(0);

    const ragConfigRes = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/rag/providers/ollama/config",
      body: {
        baseUrl: mockAiServer!.baseUrl,
        defaultModel: "embed-model",
      },
    });
    expect(ragConfigRes.status).toBe(200);

    const ragRuntimeRes = await requestJson({
      baseUrl,
      method: "PATCH",
      path: "/api/rag/runtime",
      body: {
        activeProviderId: "ollama",
        activeModel: "embed-model",
        activeTokenId: null,
      },
    });
    expect(ragRuntimeRes.status).toBe(200);

    const ragEmbRes = await requestJson<ApiEnvelope<{ embeddings: number[][] }>>({
      baseUrl,
      method: "POST",
      path: "/api/rag/embeddings",
      body: { input: "rag smoke" },
    });
    expect(ragEmbRes.status).toBe(200);
    expect(Array.isArray(ragEmbRes.data.data.embeddings)).toBe(true);

    const { chatId, branchId } = await createEntityProfileAndChat({ baseUrl, name: "WorldInfo Smoke" });
    const wiBookRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/world-info/books",
      body: {
        name: "Book Smoke",
        data: {
          entries: {
            hero: {
              uid: 1,
              key: ["hero"],
              keysecondary: [],
              content: "hero world info",
              constant: false,
              selective: false,
              order: 100,
              position: 0,
              disable: false,
              addMemo: true,
              excludeRecursion: false,
              probability: 100,
              useProbability: true,
            },
          },
        },
      },
    });
    expect(wiBookRes.status).toBe(200);

    const wiResolveRes = await requestJson({
      baseUrl,
      method: "POST",
      path: "/api/world-info/resolve",
      body: {
        chatId,
        branchId,
        trigger: "generate",
      },
    });
    expect(wiResolveRes.status).toBe(200);

    const uploadForm = new FormData();
    uploadForm.append(
      "files",
      new Blob([JSON.stringify({ hello: "world" })], {
        type: "application/json",
      }),
      "sample.json"
    );
    const uploadRes = await requestForm<ApiEnvelope<{ files: Array<{ filename: string }> }>>({
      baseUrl,
      method: "POST",
      path: "/api/files/upload",
      form: uploadForm,
    });
    expect(uploadRes.status).toBe(200);
    const fileName = uploadRes.data.data.files[0]?.filename;
    expect(fileName).toBeTruthy();

    const getFileRes = await fetch(`${baseUrl}/api/files/${fileName}`);
    expect(getFileRes.status).toBe(200);

    const delRes = await requestJson<ApiEnvelope<{ message: string }>>({
      baseUrl,
      method: "DELETE",
      path: `/api/files/${fileName}`,
    });
    expect(delRes.status).toBe(200);
  });
});
