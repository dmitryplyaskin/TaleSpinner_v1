import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { expectApiError, expectApiSuccess } from "./helpers/contracts";
import { configureLlmOpenAiCompatible, createEntityProfileAndChat } from "./helpers/fixtures";
import { collectSse, requestForm, requestJson, type SseEvent } from "./helpers/http";
import { startMockAiServer, type RunningMockAiServer } from "./helpers/mock-ai-server";
import { startInProcessServer, type RunningServer } from "./helpers/test-server";
import { createTempDataDir, removeTempDataDir } from "./helpers/tmp-dir";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2s8AAAAASUVORK5CYII=";

function eventPayload<T>(event: SseEvent): T {
  const raw = event.data as { data?: unknown } | null;
  return (raw?.data ?? raw) as T;
}

function findEvent(events: SseEvent[], name: string): SseEvent {
  const found = events.find((event) => event.event === name);
  if (!found) {
    throw new Error(`Missing SSE event: ${name}`);
  }
  return found;
}

describe("backend e2e full matrix extra", () => {
  let dataDir = "";
  let appServer: RunningServer | null = null;
  let mockAiServer: RunningMockAiServer | null = null;

  beforeAll(async () => {
    dataDir = await createTempDataDir("talespinner-e2e-full-extra-");
    mockAiServer = await startMockAiServer();
    appServer = await startInProcessServer({
      dataDir,
      tokensMasterKey: "full-extra-master-key-012345",
    });

    await configureLlmOpenAiCompatible({
      baseUrl: appServer.baseUrl,
      mockBaseUrl: mockAiServer.baseUrl,
      model: "success_text_stream",
      token: "tok_full_extra",
    });
  });

  afterAll(async () => {
    await appServer?.close();
    await mockAiServer?.close();
    await removeTempDataDir(dataDir);
  });

  test("envelope contracts and negative validation", async () => {
    const baseUrl = appServer!.baseUrl;

    const providers = expectApiSuccess<{ providers: Array<{ id: string }> }>(
      await requestJson({ baseUrl, method: "GET", path: "/api/llm/providers" })
    );
    expect(providers.providers.length).toBeGreaterThan(0);

    expectApiError(
      await requestJson({
        baseUrl,
        method: "GET",
        path: "/api/llm/models?providerId=bad&scope=global&scopeId=global",
      }),
      400,
      "VALIDATION_ERROR"
    );

    expectApiError(
      await requestJson({
        baseUrl,
        method: "GET",
        path: "/api/config/openrouter",
      }),
      410,
      "LEGACY_ENDPOINT_REMOVED"
    );
  });

  test("llm presets + rag presets lifecycle", async () => {
    const baseUrl = appServer!.baseUrl;

    const token = expectApiSuccess<{ id: string }>(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/llm/tokens",
        body: {
          providerId: "openai_compatible",
          name: "matrix-extra-token",
          token: "tok_matrix_extra",
        },
      })
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PATCH",
        path: `/api/llm/tokens/${token.id}`,
        body: { name: "matrix-extra-token-upd" },
      })
    );

    const llmPreset = expectApiSuccess<{ presetId: string }>(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/llm-presets",
        body: {
          name: "Extra LLM Preset",
          payload: {
            activeProviderId: "openai_compatible",
            activeTokenId: token.id,
            activeModel: "success_text_stream",
            providerConfigsById: {
              openai_compatible: {
                baseUrl: `${mockAiServer!.baseUrl}/v1`,
              },
            },
          },
        },
      })
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: `/api/llm-presets/${llmPreset.presetId}/apply`,
        body: { scope: "global", scopeId: "global" },
      })
    );
    expectApiSuccess(await requestJson({ baseUrl, method: "GET", path: "/api/llm-preset-settings" }));

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PUT",
        path: "/api/llm-preset-settings",
        body: { activePresetId: llmPreset.presetId },
      })
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PATCH",
        path: "/api/rag/providers/ollama/config",
        body: { baseUrl: mockAiServer!.baseUrl, defaultModel: "embed-model" },
      })
    );
    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PATCH",
        path: "/api/rag/runtime",
        body: { activeProviderId: "ollama", activeModel: "embed-model", activeTokenId: null },
      })
    );

    const ragPresetId = randomUUID();
    const now = new Date().toISOString();
    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/rag/presets",
        body: {
          id: ragPresetId,
          name: "Extra RAG Preset",
          createdAt: now,
          updatedAt: now,
          payload: {
            activeProviderId: "ollama",
            activeTokenId: null,
            activeModel: "embed-model",
            providerConfigsById: {
              ollama: { baseUrl: mockAiServer!.baseUrl, defaultModel: "embed-model" },
            },
          },
        },
      })
    );

    expectApiError(
      await requestJson({
        baseUrl,
        method: "PUT",
        path: `/api/rag/presets/${ragPresetId}`,
        body: {
          id: "another-id",
          name: "bad",
          createdAt: now,
          updatedAt: now,
          payload: {
            activeProviderId: "ollama",
            activeTokenId: null,
            activeModel: "embed-model",
            providerConfigsById: {},
          },
        },
      }),
      400,
      "VALIDATION_ERROR"
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: `/api/rag/presets/${ragPresetId}/apply`,
      })
    );

    expectApiError(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/settings/rag-presets",
        body: { selectedId: randomUUID() },
      }),
      400,
      "VALIDATION_ERROR"
    );

    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/rag/presets/${ragPresetId}` }));
    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/llm-presets/${llmPreset.presetId}` }));
    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PATCH",
        path: "/api/llm/runtime",
        body: {
          scope: "global",
          scopeId: "global",
          activeProviderId: "openai_compatible",
          activeTokenId: null,
          activeModel: "success_text_stream",
        },
      })
    );
    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/llm/tokens/${token.id}` }));
  });

  test("ui-theme/files/world-info extras", async () => {
    const baseUrl = appServer!.baseUrl;

    const themeList = expectApiSuccess<Array<{ payload: Record<string, unknown> }>>(
      await requestJson({ baseUrl, method: "GET", path: "/api/ui-theme-presets" })
    );
    expect(themeList.length).toBeGreaterThan(0);

    const createdTheme = expectApiSuccess<{ presetId: string }>(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/ui-theme-presets",
        body: {
          name: "Extra Theme",
          payload: themeList[0]!.payload,
        },
      })
    );

    const exportedTheme = expectApiSuccess<Record<string, unknown>>(
      await requestJson({
        baseUrl,
        method: "GET",
        path: `/api/ui-theme-presets/${createdTheme.presetId}/export`,
      })
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/ui-theme-presets/import",
        body: { items: exportedTheme },
      })
    );

    expectApiError(
      await requestJson({
        baseUrl,
        method: "PUT",
        path: "/api/ui-theme-settings",
        body: {},
      }),
      400,
      "VALIDATION_ERROR"
    );

    const uploadForm = new FormData();
    uploadForm.append("files", new Blob([JSON.stringify({ ok: true })], { type: "application/json" }), "extra.json");
    const uploaded = expectApiSuccess<{ files: Array<{ filename: string }> }>(
      await requestForm({
        baseUrl,
        method: "POST",
        path: "/api/files/upload",
        form: uploadForm,
      })
    );
    const filename = uploaded.files[0]?.filename;
    expect(filename).toBeTruthy();

    expectApiError(
      await requestJson({ baseUrl, method: "GET", path: `/api/files/metadata/${filename}` }),
      415,
      "UNSUPPORTED_MEDIA_TYPE"
    );

    const imageForm = new FormData();
    imageForm.append("image", new Blob([Buffer.from(PNG_1X1_BASE64, "base64")], { type: "image/png" }), "pixel.png");
    imageForm.append("folder", "extra");
    expectApiSuccess(
      await requestForm({
        baseUrl,
        method: "POST",
        path: "/api/files/upload-image",
        form: imageForm,
      })
    );

    const fixture = await createEntityProfileAndChat({ baseUrl, name: "World Extra" });
    const book = expectApiSuccess<{ id: string }>(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/world-info/books",
        body: { name: "Extra WI", data: { entries: {} } },
      })
    );

    expectApiError(
      await requestJson({
        baseUrl,
        method: "PUT",
        path: "/api/world-info/bindings",
        body: { scope: "chat", items: [{ bookId: book.id }] },
      }),
      400,
      "VALIDATION_ERROR"
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: "/api/world-info/resolve",
        body: { chatId: fixture.chatId, branchId: fixture.branchId, trigger: "generate" },
      })
    );

    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/files/${filename}` }));
    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/world-info/books/${book.id}` }));
    expectApiSuccess(await requestJson({ baseUrl, method: "DELETE", path: `/api/ui-theme-presets/${createdTheme.presetId}` }));
  });

  test("chat branches, continue and regenerate extras", async () => {
    const baseUrl = appServer!.baseUrl;
    const fixture = await createEntityProfileAndChat({ baseUrl, name: "Branches Extra" });

    const branch = expectApiSuccess<{ id: string }>(
      await requestJson({
        baseUrl,
        method: "POST",
        path: `/api/chats/${fixture.chatId}/branches`,
        body: { title: "extra branch" },
      })
    );

    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "POST",
        path: `/api/chats/${fixture.chatId}/branches/${branch.id}/activate`,
      })
    );
    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "PUT",
        path: `/api/chats/${fixture.chatId}/branches/${branch.id}`,
        body: { title: "extra branch updated" },
      })
    );
    expectApiSuccess(
      await requestJson({
        baseUrl,
        method: "DELETE",
        path: `/api/chats/${fixture.chatId}/branches/${branch.id}`,
      })
    );

    const events = await collectSse({
      baseUrl,
      path: `/api/chats/${fixture.chatId}/entries`,
      body: { role: "user", content: "extra seed", settings: {} },
      stopWhen: (event) => event.event === "llm.stream.done",
    });
    const done = eventPayload<{ status: string }>(findEvent(events, "llm.stream.done"));
    expect(done.status).toBe("done");

    const meta = eventPayload<{ assistantEntryId: string }>(findEvent(events, "llm.stream.meta"));
    expect(meta.assistantEntryId).toBeTruthy();

    expectApiError(
      await requestJson({
        baseUrl,
        method: "POST",
        path: `/api/chats/${fixture.chatId}/entries/continue`,
        body: { settings: {} },
      }),
      406,
      "NOT_ACCEPTABLE"
    );

    const regenerateEvents = await collectSse({
      baseUrl,
      path: `/api/entries/${meta.assistantEntryId}/regenerate`,
      body: { settings: {} },
      stopWhen: (event) => event.event === "llm.stream.done",
    });
    expect(eventPayload<{ status: string }>(findEvent(regenerateEvents, "llm.stream.done")).status).toBe("done");

    expectApiSuccess(await requestJson({ baseUrl, method: "GET", path: `/api/entries/${meta.assistantEntryId}/prompt-diagnostics` }));
  });
});
