import { describe, expect, test } from "vitest";

import {
  buildGatewayStreamRequest,
  resolveGatewayModel,
  resolveGatewayProviderSpec,
  splitSamplingAndExtra,
} from "./llm-gateway-adapter";

describe("llm-gateway-adapter", () => {
  test("resolveGatewayModel prefers runtime model over provider default", () => {
    const model = resolveGatewayModel({
      providerId: "openrouter",
      runtimeModel: "runtime-model",
      providerConfig: { defaultModel: "provider-default" },
    });
    expect(model).toBe("runtime-model");
  });

  test("resolveGatewayModel falls back to provider defaults and built-in defaults", () => {
    const openRouterDefault = resolveGatewayModel({
      providerId: "openrouter",
      runtimeModel: "",
      providerConfig: { defaultModel: "router-default" },
    });
    const openRouterBuiltin = resolveGatewayModel({
      providerId: "openrouter",
      runtimeModel: null,
      providerConfig: {},
    });
    const openAiCompatibleDefault = resolveGatewayModel({
      providerId: "openai_compatible",
      runtimeModel: undefined,
      providerConfig: {
        baseUrl: "http://localhost:1234/v1",
        defaultModel: "oa-default",
      },
    });
    const openAiCompatibleBuiltin = resolveGatewayModel({
      providerId: "openai_compatible",
      runtimeModel: " ",
      providerConfig: { baseUrl: "http://localhost:1234/v1" },
    });

    expect(openRouterDefault).toBe("router-default");
    expect(openRouterBuiltin).toBe(
      "google/gemini-2.0-flash-lite-preview-02-05:free",
    );
    expect(openAiCompatibleDefault).toBe("oa-default");
    expect(openAiCompatibleBuiltin).toBe("gpt-4o-mini");
  });

  test("resolveGatewayProviderSpec for openai-compatible normalizes trailing slash", () => {
    const spec = resolveGatewayProviderSpec({
      providerId: "openai_compatible",
      token: "t",
      providerConfig: { baseUrl: "http://localhost:1234/v1///" },
    });
    expect(spec).toEqual({
      id: "openai_compatible",
      token: "t",
      baseUrl: "http://localhost:1234/v1",
    });
  });

  test("splitSamplingAndExtra maps aliases and filters reserved keys", () => {
    const out = splitSamplingAndExtra({
      temperature: 0.7,
      topP: 0.9,
      max_tokens: 128,
      stopSequences: ["END", "", "DONE"],
      seed: 42,
      presencePenalty: 0.1,
      frequency_penalty: 0.2,
      model: "ignored",
      messages: "ignored",
      stream: true,
      provider: "ignored",
      customA: "x",
      customB: 2,
    });

    expect(out.sampling).toEqual({
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 128,
      stop: ["END", "DONE"],
      seed: 42,
      presence_penalty: 0.1,
      frequency_penalty: 0.2,
    });
    expect(out.extra).toEqual({
      customA: "x",
      customB: 2,
    });
  });

  test("splitSamplingAndExtra maps extended sampler aliases to snake_case extra fields", () => {
    const out = splitSamplingAndExtra({
      topK: 50,
      minP: 0.1,
      topA: 0.2,
      repetitionPenalty: 1.05,
      maxTokens: 0,
      reasoning: {
        enabled: true,
        effort: "high",
        maxTokens: 128,
        exclude: false,
      },
    });

    expect(out.sampling.max_tokens).toBeUndefined();
    expect(out.extra).toEqual({
      top_k: 50,
      min_p: 0.1,
      top_a: 0.2,
      repetition_penalty: 1.05,
      reasoning: {
        enabled: true,
        effort: "high",
        max_tokens: 128,
        exclude: false,
      },
    });
  });

  test("buildGatewayStreamRequest assembles provider/model/messages/sampling/extra", () => {
    const abortController = new AbortController();
    const req = buildGatewayStreamRequest({
      providerId: "openrouter",
      token: "tok",
      providerConfig: { defaultModel: "router-default" },
      runtimeModel: null,
      messages: [{ role: "user", content: "hi" }],
      settings: {
        temperature: 1,
        extraField: "x",
      },
      abortSignal: abortController.signal,
    });

    expect(req).toEqual({
      provider: { id: "openrouter", token: "tok" },
      model: "router-default",
      messages: [{ role: "user", content: "hi" }],
      sampling: { temperature: 1 },
      extra: { extraField: "x" },
      features: {
        messageNormalization: {
          enabled: true,
          mergeSystem: true,
          mergeConsecutiveAssistant: false,
        },
      },
      abortSignal: abortController.signal,
    });
  });

  test("buildGatewayStreamRequest enables message normalization by default when config has no explicit flag", () => {
    const req = buildGatewayStreamRequest({
      providerId: "openai_compatible",
      token: "tok",
      providerConfig: {
        baseUrl: "http://localhost:1234/v1",
      },
      runtimeModel: null,
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    expect(req.features).toEqual({
      messageNormalization: {
        enabled: true,
        mergeSystem: true,
        mergeConsecutiveAssistant: false,
      },
    });
  });

  test("buildGatewayStreamRequest allows disabling message normalization explicitly", () => {
    const req = buildGatewayStreamRequest({
      providerId: "openrouter",
      token: "tok",
      providerConfig: {
        messageNormalization: { enabled: false },
      },
      runtimeModel: null,
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    expect(req.features).toEqual({
      messageNormalization: {
        enabled: false,
      },
    });
  });

  test("buildGatewayStreamRequest injects both message normalization and anthropic cache features", () => {
    const req = buildGatewayStreamRequest({
      providerId: "openrouter",
      token: "tok",
      providerConfig: {
        defaultModel: "anthropic/claude-3.5-sonnet",
        anthropicCache: { enabled: true, depth: 2, ttl: "1h" },
      },
      runtimeModel: null,
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    expect(req.features).toEqual({
      messageNormalization: {
        enabled: true,
        mergeSystem: true,
        mergeConsecutiveAssistant: false,
      },
      anthropicCache: { enabled: true, depth: 2, ttl: "1h" },
    });
  });

  test("buildGatewayStreamRequest maps OpenRouter routing config to provider payload", () => {
    const req = buildGatewayStreamRequest({
      providerId: "openrouter",
      token: "tok",
      providerConfig: {
        openRouterRouting: {
          strategy: "priority",
          providerOrder: ["google-ai-studio", "google-vertex/global"],
          allowFallbacks: false,
          zdr: true,
          dataCollection: "deny",
          requireParameters: true,
        },
      },
      runtimeModel: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    expect(req.extra).toEqual({
      provider: {
        order: ["google-ai-studio", "google-vertex/global"],
        allow_fallbacks: false,
        zdr: true,
        data_collection: "deny",
        require_parameters: true,
      },
    });
  });

  test("buildGatewayStreamRequest maps OpenRouter sort strategies", () => {
    const req = buildGatewayStreamRequest({
      providerId: "openrouter",
      token: "tok",
      providerConfig: { openRouterRouting: { strategy: "latency" } },
      runtimeModel: "model-x",
      messages: [{ role: "user", content: "hi" }],
      settings: {},
    });

    expect(req.extra).toEqual({ provider: { sort: "latency" } });
  });
});
