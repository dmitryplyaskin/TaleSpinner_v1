import { z } from "zod";

import type { LlmGatewayMessage, LlmGatewayNormalizeMessagesResult, LlmGatewayPlugin } from "../types";

export type MessageNormalizationFeature = {
  /** If true, merges all system messages into a single system message. Default: true. */
  mergeSystem?: boolean;
  /**
   * If true, resolves consecutive assistant messages by merging them with separator.
   * Default: true.
   */
  mergeConsecutiveAssistant?: boolean;
  /** Separator used when merging contents. Default: "\\n\\n". */
  separator?: string;
};

export const messageNormalizationSchema = z
  .object({
    mergeSystem: z.boolean().optional(),
    mergeConsecutiveAssistant: z.boolean().optional(),
    separator: z.string().optional(),
  })
  .passthrough();

function mergeContents(items: string[], sep: string): string {
  return items.map((s) => String(s ?? "").trim()).filter(Boolean).join(sep);
}

function mergeSystemMessages(messages: LlmGatewayMessage[], sep: string): LlmGatewayMessage[] {
  const systemParts: string[] = [];
  const rest: LlmGatewayMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else rest.push(m);
  }

  const merged = mergeContents(systemParts, sep);
  if (!merged) return rest;
  return [{ role: "system", content: merged }, ...rest];
}

function mergeConsecutiveAssistant(messages: LlmGatewayMessage[], sep: string): LlmGatewayMessage[] {
  const out: LlmGatewayMessage[] = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (prev && prev.role === "assistant" && m.role === "assistant") {
      out[out.length - 1] = {
        role: "assistant",
        content: mergeContents([prev.content, m.content], sep),
      };
      continue;
    }
    out.push(m);
  }
  return out;
}

/**
 * Default normalization plugin.
 *
 * Goals:
 * - Make requests more compatible with strict providers:
 *   - multiple system messages -> single merged system
 *   - consecutive assistant messages -> merged
 */
export const messageNormalizationPlugin: LlmGatewayPlugin<MessageNormalizationFeature> = {
  id: "messageNormalization",
  schema: messageNormalizationSchema,
  normalizeMessages: (_ctx, feature): LlmGatewayNormalizeMessagesResult => {
    const mergeSystem = feature?.mergeSystem ?? true;
    const mergeConsecutive = feature?.mergeConsecutiveAssistant ?? true;
    const sep = feature?.separator ?? "\n\n";

    let messages = _ctx.messages;
    const warnings: string[] = [];

    if (mergeSystem) {
      const before = messages.filter((m) => m.role === "system").length;
      messages = mergeSystemMessages(messages, sep);
      const after = messages.filter((m) => m.role === "system").length;
      if (before > 1 && after === 1) {
        warnings.push("Merged multiple system messages into one");
      }
    }

    if (mergeConsecutive) {
      const hadConsecutive =
        messages.some((m, i) => i > 0 && messages[i - 1]?.role === "assistant" && m.role === "assistant");
      messages = mergeConsecutiveAssistant(messages, sep);
      if (hadConsecutive) {
        warnings.push("Merged consecutive assistant messages");
      }
    }

    return { messages, warnings: warnings.length > 0 ? warnings : undefined };
  },
};

