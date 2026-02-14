import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { configureLlmOpenAiCompatible, createEntityProfileAndChat } from "./helpers/fixtures";
import { collectSse, requestForm, requestJson, type SseEvent } from "./helpers/http";
import { startMockAiServer, type RunningMockAiServer } from "./helpers/mock-ai-server";
import { startInProcessServer, type RunningServer } from "./helpers/test-server";
import { createTempDataDir, removeTempDataDir } from "./helpers/tmp-dir";

type ApiEnvelope<T> = { data: T };

function eventPayload<T>(event: SseEvent): T {
  const raw = event.data as { data?: unknown } | null;
  return (raw?.data ?? raw) as T;
}

describe("backend e2e full matrix", () => {
  let dataDir = "";
  let appServer: RunningServer | null = null;
  let mockAiServer: RunningMockAiServer | null = null;
  let entityProfileId = "";
  let chatId = "";
  let branchId = "";
  let assistantEntryId = "";
  let assistantVariantId = "";
  let assistantMainPartId = "";

  beforeAll(async () => {
    dataDir = await createTempDataDir("talespinner-e2e-full-");
    mockAiServer = await startMockAiServer();
    appServer = await startInProcessServer({
      dataDir,
      tokensMasterKey: "full-matrix-master-key-012345",
    });

    await configureLlmOpenAiCompatible({
      baseUrl: appServer.baseUrl,
      mockBaseUrl: mockAiServer.baseUrl,
      model: "success_text_stream",
      token: "tok_full",
    });

    const fixture = await createEntityProfileAndChat({
      baseUrl: appServer.baseUrl,
      name: "Full Matrix Profile",
    });
    entityProfileId = fixture.entityProfileId;
    chatId = fixture.chatId;
    branchId = fixture.branchId;

    const seedEvents = await collectSse({
      baseUrl: appServer.baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "seed for full matrix",
        settings: {},
      },
      stopWhen: (event) => event.event === "llm.stream.done",
    });
    const meta = eventPayload<{
      assistantEntryId: string;
      assistantVariantId: string;
      assistantMainPartId: string;
    }>(seedEvents.find((event) => event.event === "llm.stream.meta") as SseEvent);
    assistantEntryId = meta.assistantEntryId;
    assistantVariantId = meta.assistantVariantId;
    assistantMainPartId = meta.assistantMainPartId;
  });

  afterAll(async () => {
    await appServer?.close();
    await mockAiServer?.close();
    await removeTempDataDir(dataDir);
  });

  test("entity/chats/chat-entries/generations groups", async () => {
    const baseUrl = appServer!.baseUrl;

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/entity-profiles" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/entity-profiles/${entityProfileId}` })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PUT",
          path: `/api/entity-profiles/${entityProfileId}`,
          body: { name: "Full Matrix Profile Updated" },
        })
      ).status
    ).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/entity-profiles/${entityProfileId}/chats` })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/entity-profiles/missing" })).status).toBe(404);

    expect((await requestJson({ baseUrl, method: "GET", path: `/api/chats/${chatId}` })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PUT",
          path: `/api/chats/${chatId}`,
          body: { title: "Matrix Chat Updated" },
        })
      ).status
    ).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/chats/${chatId}/branches` })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/chats/missing" })).status).toBe(404);

    expect((await requestJson({ baseUrl, method: "GET", path: `/api/chats/${chatId}/entries?branchId=${branchId}` })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/entries/${assistantEntryId}/variants` })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/entries/${assistantEntryId}/variants/${assistantVariantId}/select`,
        })
      ).status
    ).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/entries/${assistantEntryId}/manual-edit`,
          body: { content: "manual edit matrix" },
        })
      ).status
    ).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/chats/${chatId}/world-info/latest-activations` })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/entries/${assistantEntryId}/prompt-visibility`,
          body: { includeInPrompt: false },
        })
      ).status
    ).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: `/api/parts/${assistantMainPartId}/soft-delete`,
          body: { by: "user" },
        })
      ).status
    ).toBe(200);
    expect((await requestJson({ baseUrl, method: "POST", path: "/api/generations/missing/abort" })).status).toBe(404);
  });

  test("instructions/operation-profiles/user-persons/samplers groups", async () => {
    const baseUrl = appServer!.baseUrl;

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/instructions" })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: "/api/instructions/prerender",
          body: { templateText: "Hello {{char.name}}", chatId, branchId, entityProfileId },
        })
      ).status
    ).toBe(200);

    const instructionRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/instructions",
      body: { name: "Matrix instruction", templateText: "System prompt" },
    });
    expect(instructionRes.status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PUT",
          path: `/api/instructions/${instructionRes.data.data.id}`,
          body: { name: "Matrix instruction updated" },
        })
      ).status
    ).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/operation-profiles" })).status).toBe(200);
    const opCreateRes = await requestJson<ApiEnvelope<{ profileId: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/operation-profiles",
      body: {
        input: {
          name: "Matrix OP",
          enabled: true,
          executionMode: "sequential",
          operationProfileSessionId: randomUUID(),
          operations: [],
        },
      },
    });
    expect(opCreateRes.status).toBe(200);
    const opProfileId = opCreateRes.data.data.profileId;
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/operation-profiles/active" })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PUT",
          path: "/api/operation-profiles/active",
          body: { activeProfileId: opProfileId },
        })
      ).status
    ).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/user-persons" })).status).toBe(200);
    const userRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/user-persons",
      body: { name: "Matrix User" },
    });
    expect(userRes.status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/settings/user-persons" })).status).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/samplers" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/settings/samplers" })).status).toBe(200);
  });

  test("llm/llm-presets/rag groups", async () => {
    const baseUrl = appServer!.baseUrl;

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm/providers" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm/runtime?scope=global&scopeId=global" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm/tokens?providerId=openai_compatible" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm/models?providerId=openai_compatible&scope=global&scopeId=global" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/config/openrouter" })).status).toBe(410);

    const llmPresetRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/llm-presets",
      body: {
        name: "Matrix Preset",
        payload: {
          activeProviderId: "openai_compatible",
          activeModel: "success_text_stream",
          activeTokenId: null,
          providerConfigsById: { openai_compatible: { baseUrl: `${mockAiServer!.baseUrl}/v1` } },
        },
      },
    });
    expect(llmPresetRes.status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm-presets" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/llm-preset-settings" })).status).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/rag/providers" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/rag/runtime" })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PATCH",
          path: "/api/rag/providers/ollama/config",
          body: { baseUrl: mockAiServer!.baseUrl, defaultModel: "embed-model" },
        })
      ).status
    ).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "PATCH",
          path: "/api/rag/runtime",
          body: { activeProviderId: "ollama", activeModel: "embed-model", activeTokenId: null },
        })
      ).status
    ).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/rag/presets" })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: "/api/rag/embeddings",
          body: { input: "matrix rag" },
        })
      ).status
    ).toBe(200);
  });

  test("world-info/ui-theme/files/models/generate/settings/app-settings/sidebars groups", async () => {
    const baseUrl = appServer!.baseUrl;

    const wiCreateRes = await requestJson<ApiEnvelope<{ id: string }>>({
      baseUrl,
      method: "POST",
      path: "/api/world-info/books",
      body: {
        name: "WI Matrix",
        data: {
          entries: {
            wi1: {
              uid: 1,
              key: ["matrix"],
              keysecondary: [],
              content: "matrix content",
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
    expect(wiCreateRes.status).toBe(200);
    const wiBookId = wiCreateRes.data.data.id;
    expect((await requestJson({ baseUrl, method: "GET", path: `/api/world-info/books/${wiBookId}` })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/world-info/settings" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/world-info/bindings" })).status).toBe(200);
    expect(
      (
        await requestJson({
          baseUrl,
          method: "POST",
          path: "/api/world-info/resolve",
          body: { chatId, branchId, trigger: "generate" },
        })
      ).status
    ).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/ui-theme-presets" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/ui-theme-settings" })).status).toBe(200);

    const uploadForm = new FormData();
    uploadForm.append("files", new Blob([JSON.stringify({ ok: true })], { type: "application/json" }), "matrix.json");
    const uploadRes = await requestForm<ApiEnvelope<{ files: Array<{ filename: string }> }>>({
      baseUrl,
      method: "POST",
      path: "/api/files/upload",
      form: uploadForm,
    });
    expect(uploadRes.status).toBe(200);
    const uploadedFilename = uploadRes.data.data.files[0]?.filename;
    expect(uploadedFilename).toBeTruthy();
    expect((await fetch(`${baseUrl}/api/files/${uploadedFilename}`)).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "DELETE", path: `/api/files/${uploadedFilename}` })).status).toBe(200);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/models" })).status).toBe(200);
    const legacyGenerateEvents = await collectSse({
      baseUrl,
      path: "/api/generate",
      body: {
        messages: [{ role: "user", content: "legacy generate matrix" }],
        settings: {},
      },
      stopWhen: (event) => event.data === "[DONE]",
    });
    expect(legacyGenerateEvents.length).toBeGreaterThan(0);

    expect((await requestJson({ baseUrl, method: "GET", path: "/api/settings" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/app-settings" })).status).toBe(200);
    expect((await requestJson({ baseUrl, method: "GET", path: "/api/sidebars" })).status).toBe(200);
  });
});
