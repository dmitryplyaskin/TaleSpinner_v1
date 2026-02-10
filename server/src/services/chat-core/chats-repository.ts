import { and, desc, eq, lt, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import {
  chatBranches,
  chatMessages,
  chats,
  messageVariants,
  promptTemplates,
} from "../../db/schema";

let _lastTsMs = 0;
function nowMonotonicDate(): Date {
  const ms = Date.now();
  _lastTsMs = ms <= _lastTsMs ? _lastTsMs + 1 : ms;
  return new Date(_lastTsMs);
}

export type ChatDto = {
  id: string;
  ownerId: string;
  entityProfileId: string;
  title: string;
  activeBranchId: string | null;
  promptTemplateId: string | null;
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
    promptTemplateId: row.promptTemplateId ?? null,
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

function messageRowToDto(
  row: typeof chatMessages.$inferSelect
): ChatMessageDto {
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

function isDeletedMessageMeta(meta: unknown | null): boolean {
  if (!meta || typeof meta !== "object") return false;
  const obj = meta as Record<string, unknown>;
  return obj.deleted === true || typeof obj.deletedAt === "string";
}

function buildPreview(text: string, maxLen = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLen
    ? `${normalized.slice(0, maxLen - 1)}…`
    : normalized;
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
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  const chatId = uuidv4();
  const mainBranchId = uuidv4();

  const templateRows = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(eq(promptTemplates.ownerId, ownerId))
    .orderBy(desc(promptTemplates.updatedAt))
    .limit(1);
  const defaultPromptTemplateId = templateRows[0]?.id ?? null;

  // Keep this simple and reliable for now (atomicity can be added later via proper tx API).
  await db.insert(chats).values({
    id: chatId,
    ownerId,
    entityProfileId: params.entityProfileId,
    title: params.title,
    activeBranchId: null,
    promptTemplateId: defaultPromptTemplateId,
    status: "active",
    createdAt: ts,
    updatedAt: ts,
    lastMessageAt: null,
    lastMessagePreview: null,
    version: 0,
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
    originChatId: null,
    originBranchId: null,
    originMessageId: null,
  });

  await db.insert(chatBranches).values({
    id: mainBranchId,
    ownerId,
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

export async function setChatPromptTemplate(params: {
  ownerId?: string;
  chatId: string;
  promptTemplateId: string | null;
}): Promise<ChatDto | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  await db
    .update(chats)
    .set({ promptTemplateId: params.promptTemplateId, updatedAt: ts })
    .where(and(eq(chats.ownerId, ownerId), eq(chats.id, params.chatId)));
  return getChatById(params.chatId);
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

export async function updateChatTitle(params: {
  chatId: string;
  title: string;
}): Promise<ChatDto | null> {
  const db = await initDb();
  const ts = new Date();
  await db
    .update(chats)
    .set({ title: params.title, updatedAt: ts })
    .where(eq(chats.id, params.chatId));
  return getChatById(params.chatId);
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
    forkedFromMessageId: null,
    forkedFromVariantId: null,
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
  });

  const rows = await db
    .select()
    .from(chatBranches)
    .where(eq(chatBranches.id, id));
  if (!rows[0]) throw new Error("Не удалось создать ветку (внутренняя ошибка).");

  return branchRowToDto(rows[0]);
}

export async function updateChatBranchTitle(params: {
  chatId: string;
  branchId: string;
  title: string;
}): Promise<ChatBranchDto | null> {
  const db = await initDb();
  const ts = new Date();
  await db
    .update(chatBranches)
    .set({ title: params.title, updatedAt: ts })
    .where(and(eq(chatBranches.id, params.branchId), eq(chatBranches.chatId, params.chatId)));

  const rows = await db
    .select()
    .from(chatBranches)
    .where(and(eq(chatBranches.id, params.branchId), eq(chatBranches.chatId, params.chatId)))
    .limit(1);
  return rows[0] ? branchRowToDto(rows[0]) : null;
}

export async function deleteChatBranch(params: {
  chatId: string;
  branchId: string;
}): Promise<{ chat: ChatDto; deletedBranchId: string }> {
  const db = await initDb();
  const chat = await getChatById(params.chatId);
  if (!chat) throw new Error("Chat не найден");

  const branches = await listChatBranches({ chatId: params.chatId });
  if (branches.length <= 1) {
    throw new Error("Нельзя удалить последнюю ветку");
  }

  const target = branches.find((branch) => branch.id === params.branchId);
  if (!target) throw new Error("Branch не найден");

  const fallback = branches.find((branch) => branch.id !== params.branchId) ?? null;
  if (!fallback) {
    throw new Error("Нельзя удалить последнюю ветку");
  }

  const ts = new Date();
  const shouldSwitchActive = chat.activeBranchId === params.branchId;

  await db.delete(chatBranches).where(eq(chatBranches.id, params.branchId));

  if (shouldSwitchActive) {
    await db
      .update(chats)
      .set({ activeBranchId: fallback.id, updatedAt: ts })
      .where(eq(chats.id, params.chatId));
  } else {
    await db
      .update(chats)
      .set({ updatedAt: ts })
      .where(eq(chats.id, params.chatId));
  }

  const updatedChat = await getChatById(params.chatId);
  if (!updatedChat) throw new Error("Chat не найден");

  return { chat: updatedChat, deletedBranchId: params.branchId };
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
  return rows
    .map(messageRowToDto)
    .reverse()
    .filter((m) => !isDeletedMessageMeta(m.meta));
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
  const ts = nowMonotonicDate();
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
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
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

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id));
  if (!rows[0])
    throw new Error("Не удалось создать сообщение (внутренняя ошибка).");
  return messageRowToDto(rows[0]);
}

export async function createAssistantMessageWithVariant(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
}): Promise<{
  assistantMessageId: string;
  variantId: string;
  createdAt: Date;
}> {
  const db = await initDb();
  const ts = nowMonotonicDate();

  const assistantMessageId = uuidv4();
  const variantId = uuidv4();

  await db.insert(chatMessages).values({
    id: assistantMessageId,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    branchId: params.branchId,
    role: "assistant",
    createdAt: ts,
    promptText: "",
    format: null,
    blocksJson: "[]",
    metaJson: null,
    activeVariantId: variantId,
  });

  await db.insert(messageVariants).values({
    id: variantId,
    ownerId: params.ownerId ?? "global",
    messageId: assistantMessageId,
    createdAt: ts,
    kind: "generation",
    promptText: "",
    blocksJson: "[]",
    metaJson: null,
    isSelected: true,
  });

  return { assistantMessageId, variantId, createdAt: ts };
}

export async function createImportedAssistantMessage(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
  promptText: string;
  meta?: unknown;
}): Promise<{
  assistantMessageId: string;
  variantId: string;
  createdAt: Date;
}> {
  const db = await initDb();
  const ts = nowMonotonicDate();

  const assistantMessageId = uuidv4();
  const variantId = uuidv4();
  const text = params.promptText ?? "";

  await db.insert(chatMessages).values({
    id: assistantMessageId,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    branchId: params.branchId,
    role: "assistant",
    createdAt: ts,
    promptText: text,
    format: null,
    blocksJson: "[]",
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
    activeVariantId: variantId,
  });

  await db.insert(messageVariants).values({
    id: variantId,
    ownerId: params.ownerId ?? "global",
    messageId: assistantMessageId,
    createdAt: ts,
    kind: "import",
    promptText: text,
    blocksJson: "[]",
    metaJson: safeJsonStringify({ importedAt: ts.toISOString() }),
    isSelected: true,
  });

  // Update chat preview fields (best-effort)
  await db
    .update(chats)
    .set({
      lastMessageAt: ts,
      lastMessagePreview: buildPreview(text),
      updatedAt: ts,
    })
    .where(eq(chats.id, params.chatId));

  return { assistantMessageId, variantId, createdAt: ts };
}

export async function updateAssistantText(params: {
  assistantMessageId: string;
  variantId: string;
  text: string;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(messageVariants)
    .set({ promptText: params.text })
    .where(eq(messageVariants.id, params.variantId));

  await db
    .update(chatMessages)
    .set({ promptText: params.text, activeVariantId: params.variantId })
    .where(eq(chatMessages.id, params.assistantMessageId));
}

export async function updateMessagePromptText(params: {
  messageId: string;
  text: string;
}): Promise<void> {
  const db = await initDb();
  const rows = await db
    .select({
      id: chatMessages.id,
      activeVariantId: chatMessages.activeVariantId,
    })
    .from(chatMessages)
    .where(eq(chatMessages.id, params.messageId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  if (row.activeVariantId) {
    await db
      .update(messageVariants)
      .set({ promptText: params.text })
      .where(eq(messageVariants.id, row.activeVariantId));
  }

  await db
    .update(chatMessages)
    .set({ promptText: params.text })
    .where(eq(chatMessages.id, params.messageId));
}

export async function updateAssistantBlocks(params: {
  assistantMessageId: string;
  variantId: string;
  blocks: unknown[];
}): Promise<void> {
  const db = await initDb();
  const blocksJson = safeJsonStringify(params.blocks ?? [], "[]");

  await db
    .update(messageVariants)
    .set({ blocksJson })
    .where(eq(messageVariants.id, params.variantId));

  // Keep message cache in sync with the selected variant.
  await db
    .update(chatMessages)
    .set({ blocksJson, activeVariantId: params.variantId })
    .where(eq(chatMessages.id, params.assistantMessageId));
}

export async function listMessagesForPrompt(params: {
  chatId: string;
  branchId: string;
  limit: number;
  excludeMessageIds?: string[];
}): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
  const db = await initDb();
  const rowsNewestFirst = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.chatId, params.chatId),
        eq(chatMessages.branchId, params.branchId)
      )
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(params.limit);

  const exclude = new Set(params.excludeMessageIds ?? []);
  // Return oldest->newest for prompt assembly.
  return rowsNewestFirst
    .slice()
    .reverse()
    .filter((r) => !exclude.has(r.id))
    .filter((r) => !isDeletedMessageMeta(safeJsonParse(r.metaJson, null)))
    .map((r) => ({ role: r.role, content: r.promptText ?? "" }))
    .filter((m) => m.content.trim().length > 0);
}

export async function softDeleteChatMessage(params: {
  messageId: string;
  meta?: unknown;
}): Promise<{ id: string }> {
  const db = await initDb();
  const ts = new Date().toISOString();

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, params.messageId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Message не найден");

  const currentMeta = safeJsonParse(row.metaJson, null);
  const baseMeta =
    currentMeta && typeof currentMeta === "object"
      ? (currentMeta as Record<string, unknown>)
      : {};
  const extraMeta =
    params.meta && typeof params.meta === "object"
      ? (params.meta as Record<string, unknown>)
      : {};

  const nextMeta: Record<string, unknown> = {
    ...baseMeta,
    ...extraMeta,
    deleted: true,
    deletedAt: ts,
  };

  await db
    .update(chatMessages)
    .set({
      promptText: "",
      blocksJson: "[]",
      metaJson: safeJsonStringify(nextMeta),
    })
    .where(eq(chatMessages.id, params.messageId));

  return { id: params.messageId };
}
