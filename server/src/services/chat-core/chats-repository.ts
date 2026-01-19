import { and, desc, eq, lt, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chatBranches, chatMessages, chats } from "../../db/schema";

export type ChatDto = {
  id: string;
  ownerId: string;
  entityProfileId: string;
  title: string;
  activeBranchId: string | null;
  status: "active" | "archived" | "deleted";
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  version: number;
  meta: unknown | null;
};

function chatRowToDto(row: typeof chats.$inferSelect): ChatDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    entityProfileId: row.entityProfileId,
    title: row.title,
    activeBranchId: row.activeBranchId ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt ?? null,
    lastMessagePreview: row.lastMessagePreview ?? null,
    version: row.version,
    meta: safeJsonParse(row.metaJson, null),
  };
}

export type ChatBranchDto = {
  id: string;
  ownerId: string;
  chatId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  parentBranchId: string | null;
  forkedFromMessageId: string | null;
  forkedFromVariantId: string | null;
  meta: unknown | null;
};

function branchRowToDto(row: typeof chatBranches.$inferSelect): ChatBranchDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    chatId: row.chatId,
    title: row.title ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parentBranchId: row.parentBranchId ?? null,
    forkedFromMessageId: row.forkedFromMessageId ?? null,
    forkedFromVariantId: row.forkedFromVariantId ?? null,
    meta: safeJsonParse(row.metaJson, null),
  };
}

export type ChatMessageDto = {
  id: string;
  ownerId: string;
  chatId: string;
  branchId: string;
  role: "user" | "assistant" | "system";
  createdAt: Date;
  promptText: string;
  format: string | null;
  blocks: unknown[];
  meta: unknown | null;
  activeVariantId: string | null;
};

function messageRowToDto(row: typeof chatMessages.$inferSelect): ChatMessageDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    chatId: row.chatId,
    branchId: row.branchId,
    role: row.role,
    createdAt: row.createdAt,
    promptText: row.promptText,
    format: row.format ?? null,
    blocks: safeJsonParse(row.blocksJson, [] as unknown[]),
    meta: safeJsonParse(row.metaJson, null),
    activeVariantId: row.activeVariantId ?? null,
  };
}

function buildPreview(text: string, maxLen = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
}

export async function listChatsByEntityProfile(params: {
  entityProfileId: string;
  ownerId?: string;
}): Promise<ChatDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(chats)
    .where(
      and(
        eq(chats.ownerId, params.ownerId ?? "global"),
        eq(chats.entityProfileId, params.entityProfileId),
        // Show non-deleted by default in list
        ne(chats.status, "deleted")
      )
    )
    .orderBy(desc(chats.updatedAt));
  return rows.map(chatRowToDto);
}

export async function getChatById(id: string): Promise<ChatDto | null> {
  const db = await initDb();
  const rows = await db.select().from(chats).where(eq(chats.id, id));
  return rows[0] ? chatRowToDto(rows[0]) : null;
}

export async function createChat(params: {
  ownerId?: string;
  entityProfileId: string;
  title: string;
  meta?: unknown;
}): Promise<{ chat: ChatDto; mainBranch: ChatBranchDto }> {
  const db = await initDb();
  const ts = new Date();
  const chatId = uuidv4();
  const mainBranchId = uuidv4();

  // Keep this simple and reliable for now (atomicity can be added later via proper tx API).
  await db.insert(chats).values({
    id: chatId,
    ownerId: params.ownerId ?? "global",
    entityProfileId: params.entityProfileId,
    title: params.title,
    activeBranchId: null,
    status: "active",
    createdAt: ts,
    updatedAt: ts,
    lastMessageAt: null,
    lastMessagePreview: null,
    version: 0,
    metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    originChatId: null,
    originBranchId: null,
    originMessageId: null,
  });

  await db.insert(chatBranches).values({
    id: mainBranchId,
    ownerId: params.ownerId ?? "global",
    chatId: chatId,
    title: "main",
    createdAt: ts,
    updatedAt: ts,
    parentBranchId: null,
    forkedFromMessageId: null,
    forkedFromVariantId: null,
    metaJson: null,
  });

  await db
    .update(chats)
    .set({ activeBranchId: mainBranchId, updatedAt: ts })
    .where(eq(chats.id, chatId));

  const createdChat = await getChatById(chatId);
  const branches = await listChatBranches({ chatId });
  const mainBranch = branches.find((b) => b.id === mainBranchId);

  if (!createdChat || !mainBranch) {
    throw new Error("Не удалось создать чат/ветку (внутренняя ошибка).");
  }

  return { chat: createdChat, mainBranch };
}

export async function softDeleteChat(id: string): Promise<ChatDto | null> {
  const db = await initDb();
  const ts = new Date();
  await db
    .update(chats)
    .set({ status: "deleted", updatedAt: ts, version: 0 })
    .where(eq(chats.id, id));
  return getChatById(id);
}

export async function listChatBranches(params: {
  chatId: string;
}): Promise<ChatBranchDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(chatBranches)
    .where(eq(chatBranches.chatId, params.chatId))
    .orderBy(desc(chatBranches.createdAt));
  return rows.map(branchRowToDto);
}

export async function createChatBranch(params: {
  ownerId?: string;
  chatId: string;
  title?: string;
  parentBranchId?: string;
  forkedFromMessageId?: string;
  forkedFromVariantId?: string;
  meta?: unknown;
}): Promise<ChatBranchDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();

  await db.insert(chatBranches).values({
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    title: params.title ?? null,
    createdAt: ts,
    updatedAt: ts,
    parentBranchId: params.parentBranchId ?? null,
    forkedFromMessageId: params.forkedFromMessageId ?? null,
    forkedFromVariantId: params.forkedFromVariantId ?? null,
    metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
  });

  const rows = await db.select().from(chatBranches).where(eq(chatBranches.id, id));
  if (!rows[0]) throw new Error("Не удалось создать ветку (внутренняя ошибка).");
  return branchRowToDto(rows[0]);
}

export async function activateBranch(params: {
  chatId: string;
  branchId: string;
}): Promise<ChatDto | null> {
  const db = await initDb();
  const ts = new Date();

  await db
    .update(chats)
    .set({ activeBranchId: params.branchId, updatedAt: ts })
    .where(eq(chats.id, params.chatId));

  return getChatById(params.chatId);
}

export async function listChatMessages(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
}): Promise<ChatMessageDto[]> {
  const db = await initDb();
  const where = [
    eq(chatMessages.chatId, params.chatId),
    eq(chatMessages.branchId, params.branchId),
  ];
  if (typeof params.before === "number") {
    where.push(lt(chatMessages.createdAt, new Date(params.before)));
  }

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...where))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(params.limit);

  // For UI it's usually nicer oldest->newest; we fetched newest-first for cursor performance.
  return rows.map(messageRowToDto).reverse();
}

export async function createChatMessage(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
  role: "user" | "assistant" | "system";
  promptText: string;
  format?: string;
  blocks?: unknown[];
  meta?: unknown;
}): Promise<ChatMessageDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();

  await db.insert(chatMessages).values({
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    branchId: params.branchId,
    role: params.role,
    createdAt: ts,
    promptText: params.promptText ?? "",
    format: params.format ?? null,
    blocksJson: safeJsonStringify(params.blocks ?? [], "[]"),
    metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    activeVariantId: null,
  });

  // Update chat preview fields (best-effort)
  await db
    .update(chats)
    .set({
      lastMessageAt: ts,
      lastMessagePreview: buildPreview(params.promptText ?? ""),
      updatedAt: ts,
    })
    .where(eq(chats.id, params.chatId));

  const rows = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
  if (!rows[0]) throw new Error("Не удалось создать сообщение (внутренняя ошибка).");
  return messageRowToDto(rows[0]);
}

