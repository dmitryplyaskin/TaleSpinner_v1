import { z } from "zod";

import type {
  LlmGatewayLogger,
  LlmGatewayPlugin,
  LlmGatewayPluginExecutionContext,
  LlmGatewayProviderRequest,
  LlmGatewayRequest,
  LlmGatewayResult,
  LlmGatewayStreamEvent,
  LlmProviderAdapter,
  LlmSamplingParams,
} from "./types";
import { LlmGatewayError } from "./types";

const requestSchema = z.object({
  provider: z.object({
    id: z.string().min(1),
    token: z.string().min(1),
    baseUrl: z.string().min(1).optional(),
    config: z.unknown().optional(),
  }),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  sampling: z
    .object({
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      max_tokens: z.number().optional(),
      stop: z.union([z.string(), z.array(z.string())]).optional(),
      seed: z.number().optional(),
      presence_penalty: z.number().optional(),
      frequency_penalty: z.number().optional(),
    })
    .optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional(),
  abortSignal: z.unknown().optional(),
});

function noop(): void {}

function createDefaultLogger(): LlmGatewayLogger {
  return {
    debug: noop,
    info: (message: string, meta?: unknown) => console.info(message, meta),
    warn: (message: string, meta?: unknown) => console.warn(message, meta),
    error: (message: string, meta?: unknown) => console.error(message, meta),
  };
}

function mergeWarnings(base: string[], next?: string[] | null): string[] {
  if (!next || next.length === 0) return base;
  return base.concat(next);
}

function shallowMerge<T extends Record<string, unknown>>(
  base: T,
  patch?: Record<string, unknown>
): T {
  if (!patch) return base;
  return { ...base, ...patch };
}

function shallowMergeStr(
  base: Record<string, string>,
  patch?: Record<string, string>
): Record<string, string> {
  if (!patch) return base;
  return { ...base, ...patch };
}

function normalizeSampling(sampling?: LlmSamplingParams): LlmSamplingParams {
  return sampling ?? {};
}

function normalizeExtra(extra?: Record<string, unknown>): Record<string, unknown> {
  return extra ?? {};
}

function normalizeFeatures(features?: Record<string, unknown>): Record<string, unknown> {
  return features ?? {};
}

export type CreateLlmGatewayParams = {
  providers: Array<LlmProviderAdapter> | Record<string, LlmProviderAdapter>;
  plugins?: Array<LlmGatewayPlugin>;
  logger?: LlmGatewayLogger;
};

export class LlmGateway {
  private readonly providersById: Record<string, LlmProviderAdapter>;
  private readonly plugins: Array<LlmGatewayPlugin>;
  private readonly logger: LlmGatewayLogger;

  constructor(params: CreateLlmGatewayParams) {
    this.providersById = Array.isArray(params.providers)
      ? Object.fromEntries(params.providers.map((p) => [p.id, p]))
      : params.providers;
    this.plugins = params.plugins ?? [];
    this.logger = params.logger ?? createDefaultLogger();
  }

  private getProviderOrThrow(providerId: string): LlmProviderAdapter {
    const provider = this.providersById[providerId];
    if (!provider) {
      throw new LlmGatewayError(
        "PROVIDER_NOT_FOUND",
        `Provider not registered: ${providerId}`,
        { providerId }
      );
    }
    return provider;
  }

  private getActivePlugins(ctx: {
    providerId: string;
    model: string;
    features: Record<string, unknown>;
  }): Array<LlmGatewayPlugin> {
    return this.plugins.filter((p) => {
      if (!p.match) return true;
      try {
        return !!p.match({
          providerId: ctx.providerId,
          model: ctx.model,
          features: ctx.features,
        });
      } catch (err) {
        this.logger.warn("llm-gateway plugin.match threw; skipping plugin", {
          pluginId: p.id,
          error: err,
        });
        return false;
      }
    });
  }

  private parsePluginFeature(plugin: LlmGatewayPlugin, features: Record<string, unknown>): unknown {
    const featureValue = features[plugin.id];
    if (typeof featureValue === "undefined") return undefined;
    if (!plugin.schema) return featureValue;
    try {
      return plugin.schema.parse(featureValue);
    } catch (err) {
      throw new LlmGatewayError("FEATURE_VALIDATION_ERROR", `Invalid feature: ${plugin.id}`, {
        pluginId: plugin.id,
        error: err,
      });
    }
  }

  private warnUnknownFeatures(params: {
    features: Record<string, unknown>;
    knownPluginIds: Set<string>;
  }): string[] {
    const warnings: string[] = [];
    for (const key of Object.keys(params.features)) {
      if (!params.knownPluginIds.has(key)) {
        const msg = `Unknown feature key ignored: ${key}`;
        warnings.push(msg);
        this.logger.warn("llm-gateway unknown feature key ignored", { key });
      }
    }
    return warnings;
  }

  private buildInitialCtx(req: LlmGatewayRequest): {
    providerId: string;
    model: string;
    messages: LlmGatewayRequest["messages"];
    sampling: LlmSamplingParams;
    extra: Record<string, unknown>;
    features: Record<string, unknown>;
    abortSignal?: AbortSignal;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  } {
    const sampling = normalizeSampling(req.sampling);
    const extra = normalizeExtra(req.extra);
    const features = normalizeFeatures(req.features as Record<string, unknown> | undefined);

    // Base payload: sampling first, then extra overrides.
    const payload: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      ...sampling,
      ...extra,
    };

    return {
      providerId: req.provider.id,
      model: req.model,
      messages: req.messages,
      sampling,
      extra,
      features,
      abortSignal: req.abortSignal,
      headers: {},
      payload,
    };
  }

  async generate(req: LlmGatewayRequest): Promise<LlmGatewayResult> {
    const parsed = requestSchema.parse(req) as unknown as LlmGatewayRequest;

    if (parsed.abortSignal) {
      const AbortSignalCtor: typeof AbortSignal | undefined =
        typeof AbortSignal === "undefined" ? undefined : AbortSignal;
      if (AbortSignalCtor && !(parsed.abortSignal instanceof AbortSignalCtor)) {
        // Some environments may not expose AbortSignal constructor; keep it permissive.
        // If it's not a real signal, ignore it.
        this.logger.warn("llm-gateway abortSignal is not an AbortSignal; ignoring");
        parsed.abortSignal = undefined;
      }
    }

    if (parsed.abortSignal?.aborted) {
      return { text: "", warnings: ["Request aborted before execution"] };
    }

    const initial = this.buildInitialCtx(parsed);
    const activePlugins = this.getActivePlugins(initial);

    let warnings: string[] = [];
    warnings = mergeWarnings(
      warnings,
      this.warnUnknownFeatures({
        features: initial.features,
        knownPluginIds: new Set(this.plugins.map((p) => p.id)),
      })
    );

    // Normalize messages
    let messages = initial.messages;
    for (const plugin of activePlugins) {
      if (!plugin.normalizeMessages) continue;
      const feature = this.parsePluginFeature(plugin, initial.features);
      const ctx: LlmGatewayPluginExecutionContext = {
        providerId: initial.providerId,
        model: initial.model,
        messages,
        sampling: initial.sampling,
        extra: initial.extra,
        headers: initial.headers,
        payload: { ...initial.payload, messages },
        features: initial.features,
        logger: this.logger,
        abortSignal: initial.abortSignal,
      };
      const out = plugin.normalizeMessages(ctx, feature);
      messages = out.messages;
      warnings = mergeWarnings(warnings, out.warnings);
    }

    // Mutate request (payload/headers)
    let headers = { ...initial.headers };
    let payload = { ...initial.payload, messages };
    for (const plugin of activePlugins) {
      if (!plugin.mutateRequest) continue;
      const feature = this.parsePluginFeature(plugin, initial.features);
      const ctx: LlmGatewayPluginExecutionContext = {
        providerId: initial.providerId,
        model: initial.model,
        messages,
        sampling: initial.sampling,
        extra: initial.extra,
        headers,
        payload,
        features: initial.features,
        logger: this.logger,
        abortSignal: initial.abortSignal,
      };
      const out = plugin.mutateRequest(ctx, feature);
      payload = shallowMerge(payload, out.payloadPatch);
      headers = shallowMergeStr(headers, out.headersPatch);
      warnings = mergeWarnings(warnings, out.warnings);
    }

    const provider = this.getProviderOrThrow(initial.providerId);
    const providerReq: LlmGatewayProviderRequest = {
      provider: parsed.provider,
      model: parsed.model,
      messages,
      payload,
      headers,
      abortSignal: initial.abortSignal,
    };

    const baseCtx: LlmGatewayPluginExecutionContext = {
      providerId: initial.providerId,
      model: initial.model,
      messages,
      sampling: initial.sampling,
      extra: initial.extra,
      headers,
      payload,
      features: initial.features,
      logger: this.logger,
      abortSignal: initial.abortSignal,
    };

    // Cache wrappers (non-stream only). Apply plugins in order, outer-first.
    let callProvider = async (): Promise<LlmGatewayResult> => provider.generate(providerReq);
    for (const plugin of activePlugins) {
      if (!plugin.cache) continue;
      const prev = callProvider;
      const feature = this.parsePluginFeature(plugin, initial.features);
      callProvider = async () => plugin.cache!(baseCtx, feature, prev);
    }

    let result = await callProvider();
    if (warnings.length > 0) {
      result = { ...result, warnings: mergeWarnings(result.warnings ?? [], warnings) };
    }

    // Result transforms
    for (const plugin of activePlugins) {
      if (!plugin.transformResult) continue;
      const feature = this.parsePluginFeature(plugin, initial.features);
      result = plugin.transformResult(baseCtx, feature, result);
    }

    return result;
  }

  stream(req: LlmGatewayRequest): AsyncGenerator<LlmGatewayStreamEvent> {
    const self = this;
    async function* run(): AsyncGenerator<LlmGatewayStreamEvent> {
      const parsed = requestSchema.parse(req) as unknown as LlmGatewayRequest;

      if (parsed.abortSignal) {
        const AbortSignalCtor: typeof AbortSignal | undefined =
          typeof AbortSignal === "undefined" ? undefined : AbortSignal;
        if (AbortSignalCtor && !(parsed.abortSignal instanceof AbortSignalCtor)) {
          self.logger.warn("llm-gateway abortSignal is not an AbortSignal; ignoring");
          parsed.abortSignal = undefined;
        }
      }

      if (parsed.abortSignal?.aborted) {
        yield { type: "done", status: "aborted", warnings: ["Request aborted before execution"] };
        return;
      }

      const initial = self.buildInitialCtx(parsed);
      const activePlugins = self.getActivePlugins(initial);

      let warnings: string[] = [];
      warnings = mergeWarnings(
        warnings,
        self.warnUnknownFeatures({
          features: initial.features,
          knownPluginIds: new Set(self.plugins.map((p) => p.id)),
        })
      );

      // Normalize messages
      let messages = initial.messages;
      for (const plugin of activePlugins) {
        if (!plugin.normalizeMessages) continue;
        const feature = self.parsePluginFeature(plugin, initial.features);
        const ctx: LlmGatewayPluginExecutionContext = {
          providerId: initial.providerId,
          model: initial.model,
          messages,
          sampling: initial.sampling,
          extra: initial.extra,
          headers: initial.headers,
          payload: { ...initial.payload, messages },
          features: initial.features,
          logger: self.logger,
          abortSignal: initial.abortSignal,
        };
        const out = plugin.normalizeMessages(ctx, feature);
        messages = out.messages;
        warnings = mergeWarnings(warnings, out.warnings);
      }

      // Mutate request (payload/headers)
      let headers = { ...initial.headers };
      let payload = { ...initial.payload, messages };
      for (const plugin of activePlugins) {
        if (!plugin.mutateRequest) continue;
        const feature = self.parsePluginFeature(plugin, initial.features);
        const ctx: LlmGatewayPluginExecutionContext = {
          providerId: initial.providerId,
          model: initial.model,
          messages,
          sampling: initial.sampling,
          extra: initial.extra,
          headers,
          payload,
          features: initial.features,
          logger: self.logger,
          abortSignal: initial.abortSignal,
        };
        const out = plugin.mutateRequest(ctx, feature);
        payload = shallowMerge(payload, out.payloadPatch);
        headers = shallowMergeStr(headers, out.headersPatch);
        warnings = mergeWarnings(warnings, out.warnings);
      }

      const provider = self.getProviderOrThrow(initial.providerId);
      const providerReq: LlmGatewayProviderRequest = {
        provider: parsed.provider,
        model: parsed.model,
        messages,
        payload,
        headers,
        abortSignal: initial.abortSignal,
      };

      const baseCtx: LlmGatewayPluginExecutionContext = {
        providerId: initial.providerId,
        model: initial.model,
        messages,
        sampling: initial.sampling,
        extra: initial.extra,
        headers,
        payload,
        features: initial.features,
        logger: self.logger,
        abortSignal: initial.abortSignal,
      };

      let stream = provider.stream(providerReq);
      for (const plugin of activePlugins) {
        if (!plugin.wrapStream) continue;
        const feature = self.parsePluginFeature(plugin, initial.features);
        stream = plugin.wrapStream(stream, baseCtx, feature);
      }

      for await (const evt of stream) {
        if (evt.type === "done") {
          const merged = warnings.length > 0 ? mergeWarnings(evt.warnings ?? [], warnings) : evt.warnings;
          yield merged && merged.length > 0 ? { ...evt, warnings: merged } : evt;
          return;
        }
        yield evt;
      }

      // Provider ended without a done event: close it.
      yield {
        type: "done",
        status: parsed.abortSignal?.aborted ? "aborted" : "done",
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return run();
  }
}

export function createLlmGateway(params: CreateLlmGatewayParams): LlmGateway {
  return new LlmGateway(params);
}

