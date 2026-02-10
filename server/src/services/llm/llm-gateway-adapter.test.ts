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
      providerConfig: { baseUrl: "http://localhost:1234/v1", defaultModel: "oa-default" },
    });
    const openAiCompatibleBuiltin = resolveGatewayModel({
      providerId: "openai_compatible",
      runtimeModel: " ",
      providerConfig: { baseUrl: "http://localhost:1234/v1" },
    });

    expect(openRouterDefault).toBe("router-default");
    expect(openRouterBuiltin).toBe("google/gemini-2.0-flash-lite-preview-02-05:free");
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
      abortSignal: abortController.signal,
    });
  });
});
