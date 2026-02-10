import { z } from "zod";
import { describe, expect, test, vi } from "vitest";

import { createLlmGateway } from "./gateway";
import { LlmGatewayError, type LlmGatewayPlugin, type LlmGatewayProviderRequest } from "./types";

async function collectStream<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe("LlmGateway", () => {
  test("throws PROVIDER_NOT_FOUND for unknown provider id", async () => {
    const gateway = createLlmGateway({
      providers: [],
    });

    await expect(
      gateway.generate({
        provider: { id: "missing", token: "t" },
        model: "m",
        messages: [{ role: "user", content: "hi" }],
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_NOT_FOUND",
    });
  });

  test("runs plugin pipeline in generate and merges unknown-feature warning", async () => {
    const generateSpy = vi.fn(async (req: LlmGatewayProviderRequest) => ({
      text: `provider:${req.messages.map((m) => m.content).join("|")}`,
      warnings: ["provider-warning"],
    }));

    const provider = {
      id: "p1",
      generate: generateSpy,
      stream: async function* () {
        yield { type: "done" as const, status: "done" as const };
      },
    };

    const plugin: LlmGatewayPlugin<{ enabled: boolean }> = {
      id: "featureA",
      schema: z.object({ enabled: z.boolean() }),
      match: () => true,
      normalizeMessages: (ctx) => ({
        messages: [...ctx.messages, { role: "assistant", content: "from-normalize" }],
        warnings: ["normalize-warning"],
      }),
      mutateRequest: () => ({
        payloadPatch: { pluginPayload: 1 },
        headersPatch: { "X-Test": "ok" },
        warnings: ["mutate-warning"],
      }),
      cache: async (_ctx, _feature, next) => {
        const out = await next();
        return { ...out, warnings: [...(out.warnings ?? []), "cache-warning"] };
      },
      transformResult: (_ctx, _feature, result) => ({
        ...result,
        text: `${result.text}:transformed`,
      }),
    };

    const warns: unknown[] = [];
    const gateway = createLlmGateway({
      providers: [provider],
      plugins: [plugin],
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: (message, meta) => warns.push({ message, meta }),
        error: () => undefined,
      },
    });

    const result = await gateway.generate({
      provider: { id: "p1", token: "tok" },
      model: "m1",
      messages: [{ role: "user", content: "u1" }],
      features: {
        featureA: { enabled: true },
        unknownFeature: true,
      },
      sampling: { temperature: 0.8 },
      extra: { extraA: "x" },
    });

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Test": "ok" },
        messages: [
          { role: "user", content: "u1" },
          { role: "assistant", content: "from-normalize" },
        ],
        payload: expect.objectContaining({
          model: "m1",
          temperature: 0.8,
          extraA: "x",
          pluginPayload: 1,
          messages: [
            { role: "user", content: "u1" },
            { role: "assistant", content: "from-normalize" },
          ],
        }),
      })
    );
    expect(result.text).toBe("provider:u1|from-normalize:transformed");
    expect(result.warnings).toEqual([
      "provider-warning",
      "cache-warning",
      "Unknown feature key ignored: unknownFeature",
      "normalize-warning",
      "mutate-warning",
    ]);
    expect(warns).toHaveLength(1);
  });

  test("throws FEATURE_VALIDATION_ERROR when plugin feature schema fails", async () => {
    const provider = {
      id: "p1",
      generate: async () => ({ text: "x" }),
      stream: async function* () {
        yield { type: "done" as const, status: "done" as const };
      },
    };
    const plugin: LlmGatewayPlugin<{ enabled: boolean }> = {
      id: "featureA",
      schema: z.object({ enabled: z.boolean() }),
      match: () => true,
      normalizeMessages: (ctx) => ({ messages: ctx.messages }),
    };
    const gateway = createLlmGateway({
      providers: [provider],
      plugins: [plugin],
    });

    await expect(
      gateway.generate({
        provider: { id: "p1", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u1" }],
        features: { featureA: { enabled: "bad" } as any },
      })
    ).rejects.toBeInstanceOf(LlmGatewayError);

    await expect(
      gateway.generate({
        provider: { id: "p1", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u1" }],
        features: { featureA: { enabled: "bad" } as any },
      })
    ).rejects.toMatchObject({ code: "FEATURE_VALIDATION_ERROR" });
  });

  test("stream returns aborted done when abort signal is already aborted", async () => {
    const provider = {
      id: "p1",
      generate: async () => ({ text: "x" }),
      stream: async function* () {
        yield { type: "delta" as const, text: "never" };
      },
    };
    const gateway = createLlmGateway({ providers: [provider] });
    const ac = new AbortController();
    ac.abort();

    const events = await collectStream(
      gateway.stream({
        provider: { id: "p1", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u1" }],
        abortSignal: ac.signal,
      })
    );

    expect(events).toEqual([
      { type: "done", status: "aborted", warnings: ["Request aborted before execution"] },
    ]);
  });

  test("stream auto-closes with done event when provider stream ends without done", async () => {
    const provider = {
      id: "p1",
      generate: async () => ({ text: "x" }),
      stream: async function* () {
        yield { type: "delta" as const, text: "a" };
      },
    };
    const plugin: LlmGatewayPlugin = {
      id: "streamWrap",
      match: () => true,
      wrapStream: async function* (stream) {
        for await (const evt of stream) {
          if (evt.type === "delta") yield { ...evt, text: `${evt.text}!` };
          else yield evt;
        }
      },
    };
    const gateway = createLlmGateway({
      providers: [provider],
      plugins: [plugin],
    });

    const events = await collectStream(
      gateway.stream({
        provider: { id: "p1", token: "tok" },
        model: "m1",
        messages: [{ role: "user", content: "u1" }],
        features: { unknownFeature: true },
      })
    );

    expect(events).toEqual([
      { type: "delta", text: "a!" },
      {
        type: "done",
        status: "done",
        warnings: ["Unknown feature key ignored: unknownFeature"],
      },
    ]);
  });
});
