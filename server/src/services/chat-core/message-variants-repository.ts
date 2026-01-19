import { and, asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chatMessages, messageVariants } from "../../db/schema";

let _lastTsMs = 0;
function nowMonotonicDate(): Date {
  const ms = Date.now();
  _lastTsMs = ms <= _lastTsMs ? _lastTsMs + 1 : ms;
  return new Date(_lastTsMs);
}

export type MessageVariantDto = {
  id: string;
  ownerId: string;
  messageId: string;
  createdAt: Date;
  kind: "generation" | "manual_edit" | "import";
  promptText: string;
  blocks: unknown[];
  meta: unknown | null;
  isSelected: boolean;
};

function variantRowToDto(row: typeof messageVariants.$inferSelect): MessageVariantDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    messageId: row.messageId,
    createdAt: row.createdAt,
    kind: row.kind,
    promptText: row.promptText ?? "",
    blocks: safeJsonParse(row.blocksJson, [] as unknown[]),
    meta: safeJsonParse(row.metaJson, null),
    isSelected: Boolean(row.isSelected),
  };
}

export async function listMessageVariants(params: {
  messageId: string;
}): Promise<MessageVariantDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(messageVariants)
    .where(eq(messageVariants.messageId, params.messageId))
    .orderBy(asc(messageVariants.createdAt), asc(messageVariants.id));
  return rows.map(variantRowToDto);
}

export async function selectMessageVariant(params: {
  messageId: string;
  variantId: string;
}): Promise<MessageVariantDto | null> {
  const db = await initDb();

  const rows = await db
    .select()
    .from(messageVariants)
    .where(and(eq(messageVariants.id, params.variantId), eq(messageVariants.messageId, params.messageId)));
  const selected = rows[0];
  if (!selected) return null;

  // NOTE: better-sqlite3 transactions are sync-only; keep it simple in v1.
  await db
    .update(messageVariants)
    .set({ isSelected: false })
    .where(eq(messageVariants.messageId, params.messageId));

  await db
    .update(messageVariants)
    .set({ isSelected: true })
    .where(eq(messageVariants.id, params.variantId));

  // Keep message cache in sync with selected variant.
  await db
    .update(chatMessages)
    .set({
      activeVariantId: params.variantId,
      promptText: selected.promptText ?? "",
      blocksJson: selected.blocksJson ?? "[]",
    })
    .where(eq(chatMessages.id, params.messageId));

  return variantRowToDto({ ...selected, isSelected: true });
}

export async function createVariantForRegenerate(params: {
  ownerId?: string;
  messageId: string;
}): Promise<MessageVariantDto> {
  const db = await initDb();
  const ts = nowMonotonicDate();
  const id = uuidv4();

  await db
    .update(messageVariants)
    .set({ isSelected: false })
    .where(eq(messageVariants.messageId, params.messageId));

  await db.insert(messageVariants).values({
    id,
    ownerId: params.ownerId ?? "global",
    messageId: params.messageId,
    createdAt: ts,
    kind: "generation",
    promptText: "",
    blocksJson: "[]",
    metaJson: safeJsonStringify({ regeneratedAt: ts.toISOString() }),
    isSelected: true,
  });

  // Reset message cache to empty; streaming will fill it via updateAssistantText().
  await db
    .update(chatMessages)
    .set({
      activeVariantId: id,
      promptText: "",
      blocksJson: "[]",
    })
    .where(eq(chatMessages.id, params.messageId));

  const rows = await db.select().from(messageVariants).where(eq(messageVariants.id, id));
  if (!rows[0]) throw new Error("Не удалось создать variant (внутренняя ошибка).");
  return variantRowToDto(rows[0]);
}

export async function createManualEditVariant(params: {
  ownerId?: string;
  messageId: string;
  promptText: string;
  blocks?: unknown[];
  meta?: unknown;
}): Promise<MessageVariantDto> {
  const db = await initDb();
  const ts = nowMonotonicDate();
  const id = uuidv4();

  await db
    .update(messageVariants)
    .set({ isSelected: false })
    .where(eq(messageVariants.messageId, params.messageId));

  await db.insert(messageVariants).values({
    id,
    ownerId: params.ownerId ?? "global",
    messageId: params.messageId,
    createdAt: ts,
    kind: "manual_edit",
    promptText: params.promptText ?? "",
    blocksJson: safeJsonStringify(params.blocks ?? [], "[]"),
    metaJson:
      typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    isSelected: true,
  });

  await db
    .update(chatMessages)
    .set({
      activeVariantId: id,
      promptText: params.promptText ?? "",
      blocksJson: safeJsonStringify(params.blocks ?? [], "[]"),
    })
    .where(eq(chatMessages.id, params.messageId));

  const rows = await db.select().from(messageVariants).where(eq(messageVariants.id, id));
  if (!rows[0]) throw new Error("Не удалось создать manual_edit variant (внутренняя ошибка).");
  return variantRowToDto(rows[0]);
}

