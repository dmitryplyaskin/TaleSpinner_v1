import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chats, instructions } from "../../db/schema";

import type { InstructionMeta } from "@shared/types/instructions";

export type InstructionDto = {
  id: string;
  ownerId: string;
  name: string;
  engine: "liquidjs";
  templateText: string;
  meta: InstructionMeta | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof instructions.$inferSelect): InstructionDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    engine: row.engine as "liquidjs",
    templateText: row.templateText,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listInstructions(params: {
  ownerId?: string;
}): Promise<InstructionDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const rows = await db
    .select()
    .from(instructions)
    .where(eq(instructions.ownerId, ownerId))
    .orderBy(desc(instructions.updatedAt));
  return rows.map(rowToDto);
}

export async function getInstructionById(
  id: string
): Promise<InstructionDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(instructions)
    .where(eq(instructions.id, id));
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createInstruction(params: {
  id?: string;
  ownerId?: string;
  name: string;
  engine?: "liquidjs";
  templateText: string;
  meta?: InstructionMeta;
}): Promise<InstructionDto> {
  const db = await initDb();
  const ts = new Date();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : uuidv4();

  await db.insert(instructions).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    engine: params.engine ?? "liquidjs",
    templateText: params.templateText,
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getInstructionById(id);
  if (!created) {
    return {
      id,
      ownerId: params.ownerId ?? "global",
      name: params.name,
      engine: params.engine ?? "liquidjs",
      templateText: params.templateText,
      meta: params.meta ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return created;
}

export async function updateInstruction(params: {
  id: string;
  name?: string;
  engine?: "liquidjs";
  templateText?: string;
  meta?: InstructionMeta;
}): Promise<InstructionDto | null> {
  const db = await initDb();
  const ts = new Date();

  if (!(await getInstructionById(params.id))) return null;

  const set: Partial<typeof instructions.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.engine === "string") set.engine = params.engine;
  if (typeof params.templateText === "string")
    set.templateText = params.templateText;

  if (typeof params.meta !== "undefined") {
    set.metaJson = safeJsonStringify(params.meta);
  }

  await db
    .update(instructions)
    .set(set)
    .where(eq(instructions.id, params.id));
  return getInstructionById(params.id);
}

export async function deleteInstruction(id: string): Promise<void> {
  const db = await initDb();
  await db.delete(instructions).where(eq(instructions.id, id));
}

export async function pickInstructionForChat(params: {
  ownerId?: string;
  chatId: string;
}): Promise<InstructionDto | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const chatRows = await db
    .select({ instructionId: chats.instructionId })
    .from(chats)
    .where(and(eq(chats.ownerId, ownerId), eq(chats.id, params.chatId)))
    .limit(1);
  const instructionId = chatRows[0]?.instructionId ?? null;
  if (!instructionId) return null;

  const rows = await db
    .select()
    .from(instructions)
    .where(
      and(eq(instructions.ownerId, ownerId), eq(instructions.id, instructionId))
    )
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}
