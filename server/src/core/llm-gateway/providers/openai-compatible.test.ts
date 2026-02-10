import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  ctorArgs: [] as unknown[],
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    constructor(args: unknown) {
      mocks.ctorArgs.push(args);
    }
    chat = {
      completions: {
        create: mocks.create,
      },
    };
  },
}));

import { OpenAiCompatibleProvider } from "./openai-compatible";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ctorArgs.length = 0;
});

async function collect<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe("OpenAiCompatibleProvider", () => {
  test("generate returns completion text and usage on success", async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const provider = new OpenAiCompatibleProvider({ id: "p", defaultBaseUrl: "http://base/v1" });
    const result = await provider.generate({
      provider: { id: "p", token: "tok" },
      model: "m1",
      messages: [{ role: "user", content: "hi" }],
      payload: { temperature: 0.7, stream: false },
      headers: { "X-Test": "1" },
    });

    expect(mocks.ctorArgs[0]).toEqual({
      apiKey: "tok",
      baseURL: "http://base/v1",
      defaultHeaders: { "X-Test": "1" },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      {
        temperature: 0.7,
        model: "m1",
        messages: [{ role: "user", content: "hi" }],
      },
      { signal: undefined }
    );
    expect(result).toEqual({
      text: "hello",
      raw: { choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 1, completion_tokens: 2 } },
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });
  });

  test("generate returns aborted warning on AbortError", async () => {
    const err = new Error("aborted");
    (err as any).name = "AbortError";
    mocks.create.mockRejectedValue(err);

    const provider = new OpenAiCompatibleProvider({ id: "p" });
    const result = await provider.generate({
      provider: { id: "p", token: "tok", baseUrl: "http://custom/v1" },
      model: "m1",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: {},
    });

    expect(result).toEqual({
      text: "",
      warnings: ["Request aborted"],
    });
  });

  test("generate returns provider warning on non-abort error", async () => {
    mocks.create.mockRejectedValue(new Error("network down"));

    const provider = new OpenAiCompatibleProvider({ id: "p" });
    const result = await provider.generate({
      provider: { id: "p", token: "tok" },
      model: "m1",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: {},
    });

    expect(result.text).toBe("");
    expect(result.warnings?.[0]).toMatch(/Provider error: network down/);
    expect(result.raw).toBeInstanceOf(Error);
  });

  test("stream emits delta/reasoning and done on success", async () => {
    async function* streamChunks() {
      yield { choices: [{ delta: { content: "Hi" } }] };
      yield { choices: [{ delta: { reasoning_content: "Think" } }] };
    }
    mocks.create.mockResolvedValue(streamChunks());

    const provider = new OpenAiCompatibleProvider({ id: "p" });
    const events = await collect(
      provider.stream({
        provider: { id: "p", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u" }],
        payload: { temperature: 1 },
        headers: {},
      })
    );

    expect(events).toEqual([
      { type: "delta", text: "Hi" },
      { type: "reasoning_delta", text: "Think" },
      { type: "done", status: "done" },
    ]);
    expect(mocks.create).toHaveBeenCalledWith(
      {
        temperature: 1,
        model: "m1",
        messages: [{ role: "user", content: "u" }],
        stream: true,
      },
      { signal: undefined }
    );
  });

  test("stream returns aborted done when abort error thrown", async () => {
    const err = new Error("aborted");
    (err as any).name = "AbortError";
    mocks.create.mockRejectedValue(err);

    const provider = new OpenAiCompatibleProvider({ id: "p" });
    const events = await collect(
      provider.stream({
        provider: { id: "p", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u" }],
        payload: {},
        headers: {},
      })
    );

    expect(events).toEqual([
      { type: "done", status: "aborted", warnings: ["Request aborted"] },
    ]);
  });

  test("stream emits error and done(error) for non-abort failures", async () => {
    mocks.create.mockRejectedValue(new Error("boom"));

    const provider = new OpenAiCompatibleProvider({ id: "p" });
    const events = await collect(
      provider.stream({
        provider: { id: "p", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u" }],
        payload: {},
        headers: {},
      })
    );

    expect(events).toEqual([
      { type: "error", message: "boom" },
      { type: "done", status: "error", warnings: ["Provider error: boom"] },
    ]);
  });
});
