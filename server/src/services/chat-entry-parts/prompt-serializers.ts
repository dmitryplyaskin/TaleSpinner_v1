import { safeJsonStringify } from "../../chat-core/json";

import type { Part } from "@shared/types/chat-entry-parts";

export type PartSerializer = (part: Part) => string;

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return safeJsonStringify(value, "");
}

function asMarkdown(value: unknown): string {
  return asText(value);
}

function asJson(value: unknown): string {
  return safeJsonStringify(value, "{}");
}

function asXmlTag(value: unknown, props: Record<string, unknown> | undefined): string {
  const rawTag = typeof props?.tagName === "string" ? props.tagName : "data";
  const tagName = rawTag.trim() || "data";
  const content = typeof value === "string" ? value : safeJsonStringify(value, "{}");
  return `<${tagName}>\n${content}\n</${tagName}>`;
}

export function serializePart(part: Part): string {
  const serializerId = part.prompt?.serializerId ?? "asText";
  const props = part.prompt?.props;

  const value = part.payload;

  if (serializerId === "asText") return asText(value);
  if (serializerId === "asMarkdown") return asMarkdown(value);
  if (serializerId === "asJson") return asJson(value);
  if (serializerId === "asXmlTag") return asXmlTag(value, props);

  // Fallback: safe string representation.
  return asText(value);
}

