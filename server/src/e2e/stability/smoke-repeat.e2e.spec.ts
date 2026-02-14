import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { expectApiSuccess } from "../helpers/contracts";
import { configureLlmOpenAiCompatible, createEntityProfileAndChat } from "../helpers/fixtures";
import { collectSse, requestJson, type SseEvent } from "../helpers/http";
import { startMockAiServer, type RunningMockAiServer } from "../helpers/mock-ai-server";
import { startInProcessServer, type RunningServer } from "../helpers/test-server";
import { createTempDataDir, removeTempDataDir } from "../helpers/tmp-dir";

function eventPayload<T>(event: SseEvent): T {
  const raw = event.data as { data?: unknown } | null;
  return (raw?.data ?? raw) as T;
}

describe("backend e2e stability", () => {
  let dataDir = "";
  let appServer: RunningServer | null = null;
  let mockAiServer: RunningMockAiServer | null = null;

  beforeAll(async () => {
    dataDir = await createTempDataDir("talespinner-e2e-stability-");
    mockAiServer = await startMockAiServer();
    appServer = await startInProcessServer({
      dataDir,
      tokensMasterKey: "stability-master-key-012345",
    });
  });

  afterAll(async () => {
    await appServer?.close();
    await mockAiServer?.close();
    await removeTempDataDir(dataDir);
  });

  test("repeats critical generation flow without flakes", async () => {
    const baseUrl = appServer!.baseUrl;
    const scenarios = [
      "success_text_stream",
      "success_text_plus_reasoning",
      "success_text_stream",
      "slow_stream",
    ] as const;

    for (const [index, model] of scenarios.entries()) {
      await configureLlmOpenAiCompatible({
        baseUrl,
        mockBaseUrl: mockAiServer!.baseUrl,
        model,
        token: `tok_stability_${index}`,
      });

      const fixture = await createEntityProfileAndChat({
        baseUrl,
        name: `Stability Profile ${index}`,
      });

      const events = await collectSse({
        baseUrl,
        path: `/api/chats/${fixture.chatId}/entries`,
        body: {
          role: "user",
          content: `stability run ${index}`,
          settings: {},
        },
        timeoutMs: 60_000,
        stopWhen: (event) => event.event === "llm.stream.done",
      });

      const doneEvent = events.find((event) => event.event === "llm.stream.done");
      expect(doneEvent).toBeTruthy();
      const donePayload = eventPayload<{ status: string }>(doneEvent as SseEvent);
      expect(donePayload.status).toBe("done");

      const deltaEvents = events.filter((event) => event.event === "llm.stream.delta");
      expect(deltaEvents.length).toBeGreaterThan(0);
      const combined = deltaEvents
        .map((event) => eventPayload<{ content?: string }>(event).content ?? "")
        .join("");
      expect(combined.length).toBeGreaterThan(0);

      const listEntries = expectApiSuccess<{ entries: Array<{ entryId: string; role: string }> }>(
        await requestJson({
          baseUrl,
          method: "GET",
          path: `/api/chats/${fixture.chatId}/entries?branchId=${fixture.branchId}`,
        })
      );
      expect(listEntries.entries.length).toBeGreaterThan(0);
    }
  });
});
