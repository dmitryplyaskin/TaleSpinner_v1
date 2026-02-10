import { z } from "zod";

import type { LlmGatewayPlugin } from "../types";

export type AnthropicCacheFeature = {
  enabled?: boolean;
  /**
   * Cache depth from the tail of the conversation.
   * 0 means "just before the tail dynamic window".
   */
  depth?: number;
  ttl?: "5m" | "1h";
};

declare module "../types" {
  interface LlmGatewayFeatureMap {
    anthropicCache: AnthropicCacheFeature;
  }
}

export const anthropicCacheSchema = z
  .object({
    enabled: z.boolean().optional(),
    depth: z.number().int().min(0).optional(),
    ttl: z.enum(["5m", "1h"]).optional(),
  })
  .passthrough();

type CacheControl = {
  type: "ephemeral";
  ttl?: "5m" | "1h";
};

type ContentPart = {
  type?: string;
  text?: string;
  cache_control?: CacheControl;
  [key: string]: unknown;
};

type GatewayMessageLike = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
  [key: string]: unknown;
};

function looksLikeAnthropicModel(model: string): boolean {
  const m = String(model ?? "").toLowerCase();
  return m.includes("anthropic") || m.includes("claude");
}

function cloneContent(content: unknown): string | ContentPart[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => {
    if (!item || typeof item !== "object") return {};
    return { ...(item as Record<string, unknown>) } as ContentPart;
  });
}

function normalizeMessages(input: unknown, fallback: GatewayMessageLike[]): GatewayMessageLike[] {
  if (!Array.isArray(input)) {
    return fallback.map((m) => ({
      ...m,
      content: cloneContent(m.content),
    }));
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as Record<string, unknown>).role;
      if (role !== "system" && role !== "user" && role !== "assistant") return null;
      const content = cloneContent((item as Record<string, unknown>).content);
      return {
        ...(item as Record<string, unknown>),
        role,
        content,
      } as GatewayMessageLike;
    })
    .filter((item): item is GatewayMessageLike => Boolean(item));
}

function applyCacheControl(message: GatewayMessageLike, cacheControl: CacheControl): void {
  if (typeof message.content === "string") {
    message.content = [
      {
        type: "text",
        text: message.content,
        cache_control: cacheControl,
      },
    ];
    return;
  }

  const content = message.content;
  if (content.length === 0) {
    content.push({
      type: "text",
      text: "",
      cache_control: cacheControl,
    });
    return;
  }

  for (let idx = content.length - 1; idx >= 0; idx -= 1) {
    const part = content[idx];
    if (!part || typeof part !== "object") continue;
    if (!part.type || part.type === "text") {
      part.cache_control = cacheControl;
      return;
    }
  }

  const last = content[content.length - 1];
  if (last && typeof last === "object") {
    last.cache_control = cacheControl;
    return;
  }

  content.push({
    type: "text",
    text: "",
    cache_control: cacheControl,
  });
}

function applyCacheAtDepth(
  messages: GatewayMessageLike[],
  cachingAtDepth: number,
  ttl: "5m" | "1h"
): GatewayMessageLike[] {
  const cacheControl: CacheControl = { type: "ephemeral", ttl };

  let passedTailAssistantPrefill = false;
  let depth = 0;
  let previousRole = "";

  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const message = messages[idx];

    if (!passedTailAssistantPrefill && message.role === "assistant") {
      continue;
    }

    passedTailAssistantPrefill = true;

    if (message.role !== previousRole) {
      if (depth === cachingAtDepth || depth === cachingAtDepth + 2) {
        applyCacheControl(message, cacheControl);
      }

      if (depth === cachingAtDepth + 2) {
        break;
      }

      depth += 1;
      previousRole = message.role;
    }
  }

  return messages;
}

export const anthropicCachePlugin: LlmGatewayPlugin<AnthropicCacheFeature> = {
  id: "anthropicCache",
  schema: anthropicCacheSchema,
  match: (ctx) => {
    const feature = ctx.features["anthropicCache"] as AnthropicCacheFeature | undefined;
    if (!feature || feature.enabled !== true) return false;
    return looksLikeAnthropicModel(ctx.model);
  },
  mutateRequest: (ctx, feature) => {
    if (!feature || feature.enabled !== true) return {};

    const depth = feature.depth ?? 0;
    const ttl = feature.ttl ?? "5m";
    const payloadMessages = (ctx.payload as Record<string, unknown>).messages;
    const normalized = normalizeMessages(
      payloadMessages,
      ctx.messages.map((m) => ({ ...m }))
    );
    const patched = applyCacheAtDepth(normalized, depth, ttl);

    ctx.logger.debug("anthropicCache plugin applied", {
      model: ctx.model,
      depth,
      ttl,
      messages: patched.length,
    });

    return {
      payloadPatch: {
        messages: patched,
      },
    };
  },
};
