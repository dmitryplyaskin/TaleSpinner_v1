import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  llmGatewayStream: vi.fn(),
  getRuntime: vi.fn(),
  listProviders: vi.fn(),
  listTokens: vi.fn(),
  getTokenPlaintext: vi.fn(),
  touchTokenLastUsed: vi.fn(),
  getProviderConfig: vi.fn(),
  resolveGatewayProviderSpec: vi.fn(),
  buildGatewayStreamRequest: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: mocks.axiosGet,
  },
}));

vi.mock("@core/llm-gateway", () => ({
  llmGateway: {
    stream: mocks.llmGatewayStream,
  },
}));

vi.mock("./llm-repository", () => ({
  getRuntime: mocks.getRuntime,
  listProviders: mocks.listProviders,
  listTokens: mocks.listTokens,
  getTokenPlaintext: mocks.getTokenPlaintext,
  touchTokenLastUsed: mocks.touchTokenLastUsed,
  getProviderConfig: mocks.getProviderConfig,
}));

vi.mock("./llm-gateway-adapter", () => ({
  resolveGatewayProviderSpec: mocks.resolveGatewayProviderSpec,
  buildGatewayStreamRequest: mocks.buildGatewayStreamRequest,
}));

import { HttpError } from "@core/middleware/error-handler";

import {
  getModels,
  getProvidersForUi,
  getTokensForUi,
  streamGlobalChat,
} from "./llm-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRuntime.mockResolvedValue({
    scope: "global",
    scopeId: "global",
    activeProviderId: "openrouter",
    activeTokenId: "tok-1",
    activeModel: "runtime-model",
  });
  mocks.listProviders.mockResolvedValue([
    { id: "openrouter", name: "OpenRouter", enabled: true },
  ]);
  mocks.listTokens.mockResolvedValue([
    { id: "tok-1", providerId: "openrouter", name: "main", tokenHint: "***" },
  ]);
  mocks.getTokenPlaintext.mockResolvedValue("secret");
  mocks.touchTokenLastUsed.mockResolvedValue(undefined);
  mocks.getProviderConfig.mockResolvedValue({
    providerId: "openrouter",
    config: {},
  });
  mocks.resolveGatewayProviderSpec.mockReturnValue({
    id: "openai_compatible",
    token: "secret",
    baseUrl: "http://localhost:1234/v1",
  });
  mocks.buildGatewayStreamRequest.mockImplementation((params: any) => ({
    provider: { id: params.providerId, token: params.token },
    model: params.runtimeModel ?? "model-x",
    messages: params.messages,
    sampling: {},
    extra: {},
    abortSignal: params.abortSignal,
  }));
  mocks.axiosGet.mockResolvedValue({
    data: {
      data: [
        { id: "m1", name: "Model 1" },
        { id: "m2" },
      ],
    },
  });
  mocks.llmGatewayStream.mockImplementation(async function* () {
    yield { type: "done", status: "done" as const };
  });
});

async function collect<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe("llm-service", () => {
  test("getProvidersForUi delegates listProviders", async () => {
    await expect(getProvidersForUi()).resolves.toEqual([
      { id: "openrouter", name: "OpenRouter", enabled: true },
    ]);
    expect(mocks.listProviders).toHaveBeenCalled();
  });

  test("getTokensForUi maps repository token shape for UI", async () => {
    await expect(getTokensForUi("openrouter")).resolves.toEqual([
      { id: "tok-1", name: "main", tokenHint: "***" },
    ]);
    expect(mocks.listTokens).toHaveBeenCalledWith("openrouter");
  });

  test("getModels returns [] when token id is missing", async () => {
    mocks.getRuntime.mockResolvedValueOnce({
      scope: "global",
      scopeId: "global",
      activeProviderId: "openrouter",
      activeTokenId: null,
      activeModel: null,
    });

    await expect(
      getModels({
        providerId: "openrouter",
        scope: "global",
        scopeId: "global",
      })
    ).resolves.toEqual([]);
  });

  test("getModels returns [] when plaintext token is not found", async () => {
    mocks.getTokenPlaintext.mockResolvedValueOnce(null);

    await expect(
      getModels({
        providerId: "openrouter",
        scope: "global",
        scopeId: "global",
      })
    ).resolves.toEqual([]);
  });

  test("getModels fetches openrouter model list", async () => {
    const out = await getModels({
      providerId: "openrouter",
      scope: "global",
      scopeId: "global",
    });

    expect(mocks.axiosGet).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        Authorization: "Bearer secret",
      },
    });
    expect(out).toEqual([
      { id: "m1", name: "Model 1" },
      { id: "m2", name: "m2" },
    ]);
  });

  test("getModels fetches openai-compatible model list via resolved baseUrl", async () => {
    const out = await getModels({
      providerId: "openai_compatible",
      scope: "global",
      scopeId: "global",
    });

    expect(mocks.resolveGatewayProviderSpec).toHaveBeenCalledWith({
      providerId: "openai_compatible",
      token: "secret",
      providerConfig: {},
    });
    expect(mocks.axiosGet).toHaveBeenCalledWith("http://localhost:1234/v1/models", {
      headers: {
        Authorization: "Bearer secret",
      },
    });
    expect(out).toEqual([
      { id: "m1", name: "Model 1" },
      { id: "m2", name: "m2" },
    ]);
  });

  test("getModels returns [] on fetch errors", async () => {
    mocks.axiosGet.mockRejectedValueOnce(new Error("network down"));

    await expect(
      getModels({
        providerId: "openrouter",
        scope: "global",
        scopeId: "global",
      })
    ).resolves.toEqual([]);
  });

  test("streamGlobalChat throws HttpError when active token is missing", async () => {
    mocks.getRuntime.mockResolvedValueOnce({
      scope: "global",
      scopeId: "global",
      activeProviderId: "openrouter",
      activeTokenId: null,
      activeModel: null,
    });
    mocks.listTokens.mockResolvedValueOnce([]);

    const iter = streamGlobalChat({
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    const error = await iter.next().then(
      () => null,
      (err) => err
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      code: "LLM_TOKEN_MISSING",
    });
    await expect(iter.next()).resolves.toEqual({ value: undefined, done: true });
  });

  test("streamGlobalChat throws HttpError when active token is not found", async () => {
    mocks.getTokenPlaintext.mockResolvedValueOnce(null);

    const iter = streamGlobalChat({
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    await expect(iter.next()).rejects.toMatchObject({
      code: "LLM_TOKEN_NOT_FOUND",
    });
  });

  test("streamGlobalChat falls back to next token when pre-stream error occurs", async () => {
    mocks.listTokens.mockResolvedValueOnce([
      { id: "tok-1", providerId: "openrouter", name: "main", tokenHint: "***" },
      { id: "tok-2", providerId: "openrouter", name: "backup", tokenHint: "***" },
    ]);
    mocks.getProviderConfig.mockResolvedValueOnce({
      providerId: "openrouter",
      config: { tokenPolicy: { fallbackOnError: true } },
    });
    mocks.getTokenPlaintext.mockImplementation(async (id: string) => {
      if (id === "tok-1") return "secret-1";
      if (id === "tok-2") return "secret-2";
      return null;
    });
    mocks.llmGatewayStream
      .mockImplementationOnce(async function* () {
        yield { type: "error", message: "first-token-failed" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "delta", text: "ok-from-second" };
        yield { type: "done", status: "done" as const };
      });

    const out = await collect(
      streamGlobalChat({
        messages: [{ role: "user", content: "hi" }],
        settings: {},
      })
    );

    expect(out).toEqual([{ content: "ok-from-second", reasoning: "", error: null }]);
    expect(mocks.buildGatewayStreamRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ token: "secret-1" })
    );
    expect(mocks.buildGatewayStreamRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ token: "secret-2" })
    );
  });

  test("streamGlobalChat does not fallback when error happens after first chunk", async () => {
    mocks.listTokens.mockResolvedValueOnce([
      { id: "tok-1", providerId: "openrouter", name: "main", tokenHint: "***" },
      { id: "tok-2", providerId: "openrouter", name: "backup", tokenHint: "***" },
    ]);
    mocks.getProviderConfig.mockResolvedValueOnce({
      providerId: "openrouter",
      config: { tokenPolicy: { fallbackOnError: true } },
    });
    mocks.getTokenPlaintext.mockImplementation(async (id: string) => {
      if (id === "tok-1") return "secret-1";
      if (id === "tok-2") return "secret-2";
      return null;
    });
    mocks.llmGatewayStream.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "partial" };
      yield { type: "error", message: "boom-after-partial" };
    });

    const out = await collect(
      streamGlobalChat({
        messages: [{ role: "user", content: "hi" }],
        settings: {},
      })
    );

    expect(out).toEqual([
      { content: "partial", reasoning: "", error: null },
      { content: "", reasoning: "", error: "boom-after-partial" },
    ]);
    expect(mocks.buildGatewayStreamRequest).toHaveBeenCalledTimes(1);
  });

  test("streamGlobalChat randomizes token order when randomize is enabled", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    mocks.listTokens.mockResolvedValueOnce([
      { id: "tok-1", providerId: "openrouter", name: "main", tokenHint: "***" },
      { id: "tok-2", providerId: "openrouter", name: "backup-1", tokenHint: "***" },
      { id: "tok-3", providerId: "openrouter", name: "backup-2", tokenHint: "***" },
    ]);
    mocks.getProviderConfig.mockResolvedValueOnce({
      providerId: "openrouter",
      config: { tokenPolicy: { randomize: true } },
    });
    mocks.getTokenPlaintext.mockImplementation(async (id: string) => `secret-${id}`);
    mocks.llmGatewayStream.mockImplementation(async function* () {
      yield { type: "done", status: "done" as const };
    });

    await collect(
      streamGlobalChat({
        messages: [{ role: "user", content: "hi" }],
        settings: {},
      })
    );

    expect(mocks.buildGatewayStreamRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ token: "secret-tok-2" })
    );
    randomSpy.mockRestore();
  });

  test("streamGlobalChat handles missing active token id by trying other tokens", async () => {
    mocks.getRuntime.mockResolvedValueOnce({
      scope: "global",
      scopeId: "global",
      activeProviderId: "openrouter",
      activeTokenId: "missing-token",
      activeModel: null,
    });
    mocks.listTokens.mockResolvedValueOnce([
      { id: "tok-2", providerId: "openrouter", name: "backup", tokenHint: "***" },
    ]);
    mocks.getTokenPlaintext.mockImplementation(async (id: string) => {
      if (id === "tok-2") return "secret-2";
      return null;
    });
    mocks.llmGatewayStream.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "from-backup" };
      yield { type: "done", status: "done" as const };
    });

    const out = await collect(
      streamGlobalChat({
        messages: [{ role: "user", content: "hi" }],
        settings: {},
      })
    );

    expect(out).toEqual([{ content: "from-backup", reasoning: "", error: null }]);
  });

  test("streamGlobalChat yields delta/reasoning/error events and stops on error", async () => {
    mocks.llmGatewayStream.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "hello" };
      yield { type: "reasoning_delta", text: "think" };
      yield { type: "error", message: "provider-failed" };
      yield { type: "delta", text: "unreachable" };
    });

    const out = await collect(
      streamGlobalChat({
        messages: [{ role: "user", content: "hi" }],
        settings: { temperature: 0.5 },
      })
    );

    expect(mocks.touchTokenLastUsed).toHaveBeenCalledWith("tok-1");
    expect(mocks.buildGatewayStreamRequest).toHaveBeenCalledWith({
      providerId: "openrouter",
      token: "secret",
      providerConfig: {},
      runtimeModel: "runtime-model",
      messages: [{ role: "user", content: "hi" }],
      settings: { temperature: 0.5 },
      abortSignal: undefined,
    });
    expect(out).toEqual([
      { content: "hello", reasoning: "", error: null },
      { content: "", reasoning: "think", error: null },
      { content: "", reasoning: "", error: "provider-failed" },
    ]);
  });

  test("streamGlobalChat stops early when abort signal is set", async () => {
    mocks.llmGatewayStream.mockImplementationOnce(async function* () {
      yield { type: "delta", text: "first" };
      yield { type: "delta", text: "second" };
      yield { type: "done", status: "done" as const };
    });
    const ac = new AbortController();

    const received: Array<{ content: string; reasoning: string; error: string | null }> = [];
    for await (const evt of streamGlobalChat({
      messages: [{ role: "user", content: "hi" }],
      settings: {},
      abortController: ac,
    })) {
      received.push(evt);
      ac.abort();
    }

    expect(received).toEqual([{ content: "first", reasoning: "", error: null }]);
  });
});
