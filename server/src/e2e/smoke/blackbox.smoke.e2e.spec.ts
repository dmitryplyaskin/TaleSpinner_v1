import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { configureLlmOpenAiCompatible, createEntityProfileAndChat } from "../helpers/fixtures";
import { collectSse, type SseEvent } from "../helpers/http";
import { startMockAiServer, type RunningMockAiServer } from "../helpers/mock-ai-server";
import { createTempDataDir, removeTempDataDir } from "../helpers/tmp-dir";

function eventPayload<T>(event: SseEvent): T {
  const raw = event.data as { data?: unknown } | null;
  return (raw?.data ?? raw) as T;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to allocate free port"));
        return;
      }
      const port = addr.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25_000) {
    try {
      const response = await fetch(`${baseUrl}/api/llm/providers`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Blackbox server did not become ready in time");
}

describe("backend e2e blackbox smoke", () => {
  let dataDir = "";
  let baseUrl = "";
  let mockAiServer: RunningMockAiServer | null = null;
  let processRef: ChildProcessWithoutNullStreams | null = null;

  beforeAll(async () => {
    const port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    dataDir = await createTempDataDir("talespinner-e2e-blackbox-");
    mockAiServer = await startMockAiServer();

    const serverRoot = path.resolve(__dirname, "../../..");
    processRef = spawn(
      process.execPath,
      ["-r", "ts-node/register", "-r", "tsconfig-paths/register", "src/index.ts"],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          PORT: String(port),
          TALESPINNER_DATA_DIR: dataDir,
          TOKENS_MASTER_KEY: "blackbox-master-key-012345",
        },
        stdio: "pipe",
      }
    );

    processRef.stderr.on("data", () => {
      // keep stream consumed to avoid rare pipe backpressure on long startup logs
    });

    await waitForServer(baseUrl);
  });

  afterAll(async () => {
    if (processRef && !processRef.killed) {
      processRef.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 5_000);
        processRef?.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    await mockAiServer?.close();
    await removeTempDataDir(dataDir);
  });

  test("runs one full generation flow over real HTTP process", async () => {
    await configureLlmOpenAiCompatible({
      baseUrl,
      mockBaseUrl: mockAiServer!.baseUrl,
      model: "success_text_stream",
      token: "tok_blackbox",
    });

    const { chatId } = await createEntityProfileAndChat({ baseUrl, name: "Blackbox Profile" });
    const events = await collectSse({
      baseUrl,
      path: `/api/chats/${chatId}/entries`,
      body: {
        role: "user",
        content: "blackbox hello",
        settings: {},
      },
      stopWhen: (event) => event.event === "llm.stream.done",
    });

    const doneEvent = events.find((event) => event.event === "llm.stream.done");
    expect(doneEvent).toBeTruthy();
    const donePayload = eventPayload<{ status: string }>(doneEvent as SseEvent);
    expect(donePayload.status).toBe("done");
  });
});
