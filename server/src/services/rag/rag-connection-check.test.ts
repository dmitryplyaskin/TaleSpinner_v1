import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  getTokenPlaintext: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { get: mocks.axiosGet },
}));

vi.mock("@services/llm/llm-repository", () => ({
  getTokenPlaintext: mocks.getTokenPlaintext,
}));

import { probeRagProviderConnection } from "./rag-connection-check";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTokenPlaintext.mockResolvedValue("secret");
});

describe("RAG provider connection check", () => {
  test("requires a token for OpenRouter", async () => {
    const result = await probeRagProviderConnection({
      providerId: "openrouter",
      tokenId: null,
      config: {},
    });

    expect(result).toMatchObject({ ok: false, issueCode: "TOKEN_MISSING" });
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  test("reports a missing saved token", async () => {
    mocks.getTokenPlaintext.mockResolvedValueOnce(null);
    const result = await probeRagProviderConnection({
      providerId: "openrouter",
      tokenId: "missing",
      config: {},
    });
    expect(result).toMatchObject({ ok: false, issueCode: "TOKEN_NOT_FOUND" });
  });

  test("checks the OpenRouter embedding catalog", async () => {
    mocks.axiosGet.mockResolvedValueOnce({
      status: 200,
      data: { data: [{ id: "model-1" }, { id: "model-2" }] },
    });
    const result = await probeRagProviderConnection({
      providerId: "openrouter",
      tokenId: "token-1",
      config: {},
    });

    expect(mocks.axiosGet).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/embeddings/models",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      })
    );
    expect(result).toMatchObject({ ok: true, modelCount: 2, statusCode: 200 });
  });

  test("checks the configured Ollama endpoint", async () => {
    mocks.axiosGet.mockResolvedValueOnce({
      status: 200,
      data: { models: [{ name: "nomic-embed-text" }] },
    });
    const result = await probeRagProviderConnection({
      providerId: "ollama",
      tokenId: null,
      config: { baseUrl: "http://127.0.0.1:11434/" },
    });

    expect(mocks.axiosGet).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      { timeout: 7000 }
    );
    expect(result).toMatchObject({ ok: true, modelCount: 1 });
  });

  test("maps provider authentication errors", async () => {
    mocks.axiosGet.mockRejectedValueOnce({
      response: { status: 401, data: { error: { message: "Unauthorized" } } },
    });
    const result = await probeRagProviderConnection({
      providerId: "openrouter",
      tokenId: "token-1",
      config: {},
    });

    expect(result).toMatchObject({
      ok: false,
      issueCode: "AUTH_ERROR",
      message: "Unauthorized",
      statusCode: 401,
    });
  });
});
