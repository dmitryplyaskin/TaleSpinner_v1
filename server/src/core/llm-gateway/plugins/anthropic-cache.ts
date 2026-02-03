import { z } from "zod";

import type { LlmGatewayPlugin, LlmGatewayResult } from "../types";

/**
 * Scaffold plugin for Anthropic-style caching driven by model name.
 *
 * This does NOT implement real caching yet (no storage backend),
 * but defines the contract and matching rules so it can be extended.
 */
export type AnthropicCacheFeature = {
  enabled?: boolean;
  /** How many previous turns to consider for caching (placeholder). */
  depth?: number;
};

export const anthropicCacheSchema = z
  .object({
    enabled: z.boolean().optional(),
    depth: z.number().int().min(0).optional(),
  })
  .passthrough();

function looksLikeAnthropicModel(model: string): boolean {
  const m = String(model ?? "").toLowerCase();
  // heuristics: allow both OpenRouter style and direct Anthropic ids
  return m.includes("anthropic") || m.includes("claude");
}

export const anthropicCachePlugin: LlmGatewayPlugin<AnthropicCacheFeature> = {
  id: "anthropicCache",
  schema: anthropicCacheSchema,
  match: (ctx) => {
    const feature = ctx.features["anthropicCache"] as AnthropicCacheFeature | undefined;
    if (feature && feature.enabled === false) return false;
    return looksLikeAnthropicModel(ctx.model);
  },
  cache: async (ctx, feature, next): Promise<LlmGatewayResult> => {
    if (feature && feature.enabled === false) return next();

    // Placeholder: no cache store yet.
    ctx.logger.debug("anthropicCache plugin active (no-op scaffold)", {
      model: ctx.model,
      depth: feature?.depth ?? null,
    });

    return next();
  },
};

