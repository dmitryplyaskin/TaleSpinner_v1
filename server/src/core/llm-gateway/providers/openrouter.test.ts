import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("./openai-compatible", () => ({
  OpenAiCompatibleProvider: class {
    generate = mocks.generate;
    stream = mocks.stream;
  },
}));

import { OpenRouterProvider } from "./openrouter";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generate.mockResolvedValue({ text: "ok" });
  mocks.stream.mockImplementation(async function* () {
    yield { type: "done", status: "done" };
  });
});

describe("OpenRouterProvider", () => {
  test("patches generate request with default baseUrl and OpenRouter headers", async () => {
    const provider = new OpenRouterProvider();

    await provider.generate({
      provider: { id: "openrouter", token: "tok" },
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: { "X-Title": "CustomTitle", "X-Custom": "1" },
    });

    expect(mocks.generate).toHaveBeenCalledWith({
      provider: {
        id: "openrouter",
        token: "tok",
        baseUrl: "https://openrouter.ai/api/v1",
      },
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "CustomTitle",
        "X-Custom": "1",
      },
    });
  });

  test("patches stream request and keeps explicit baseUrl", async () => {
    const provider = new OpenRouterProvider();

    const events: unknown[] = [];
    for await (const evt of provider.stream({
      provider: {
        id: "openrouter",
        token: "tok",
        baseUrl: "https://custom.router/v1",
      },
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: {},
    })) {
      events.push(evt);
    }

    expect(mocks.stream).toHaveBeenCalledWith({
      provider: {
        id: "openrouter",
        token: "tok",
        baseUrl: "https://custom.router/v1",
      },
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      payload: {},
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
      },
    });
    expect(events).toEqual([{ type: "done", status: "done" }]);
  });
});
