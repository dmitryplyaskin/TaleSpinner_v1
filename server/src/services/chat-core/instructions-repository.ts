import { randomUUID as uuidv4 } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { initDb } from "../../db/client";
import { chats, instructions } from "../../db/schema";

import type {
  InstructionKind,
  InstructionMeta,
  StBaseConfig,
} from "@shared/types/instructions";

type InstructionDtoBase = {
  id: string;
  ownerId: string;
  name: string;
  engine: "liquidjs";
  meta: InstructionMeta | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BasicInstructionDto = InstructionDtoBase & {
  kind: "basic";
  templateText: string;
};

export type StBaseInstructionDto = InstructionDtoBase & {
  kind: "st_base";
  stBase: StBaseConfig;
};

export type InstructionDto = BasicInstructionDto | StBaseInstructionDto;

function parseInstructionMeta(value: string | null): InstructionMeta | null {
  return safeJsonParse(value, null);
}

function parseStBaseConfig(row: typeof instructions.$inferSelect): StBaseConfig {
  const parsed = safeJsonParse(row.stBaseJson, null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Instruction ${row.id} is missing st_base payload`);
  }
  return parsed as StBaseConfig;
}

function rowToDto(row: typeof instructions.$inferSelect): InstructionDto {
  const meta = parseInstructionMeta(row.metaJson);
  const kind = row.kind as InstructionKind;

  if (kind === "st_base") {
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      kind: "st_base",
      engine: row.engine as "liquidjs",
      stBase: parseStBaseConfig(row),
      meta,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    kind: "basic",
    engine: row.engine as "liquidjs",
    templateText: row.templateText,
    meta,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listInstructions(params: {
  ownerId?: string;
}): Promise<InstructionDto[]> {
  const db = await initDb();
  const ownerId = resolveTrustedOwnerId(params.ownerId);
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
    .where(
      and(
        eq(instructions.id, id),
        eq(instructions.ownerId, resolveTrustedOwnerId())
      )
    );
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createInstruction(params: {
  id?: string;
  ownerId?: string;
  name: string;
  engine?: "liquidjs";
  kind: "basic";
  templateText: string;
  meta?: InstructionMeta;
} | {
  id?: string;
  ownerId?: string;
  name: string;
  engine?: "liquidjs";
  kind: "st_base";
  stBase: StBaseConfig;
  meta?: InstructionMeta;
}): Promise<InstructionDto> {
  const db = await initDb();
  const ts = new Date();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : uuidv4();

  await db.insert(instructions).values({
    id,
    ownerId: resolveTrustedOwnerId(params.ownerId),
    name: params.name,
    kind: params.kind,
    engine: params.engine ?? "liquidjs",
    templateText: params.kind === "basic" ? params.templateText : "",
    stBaseJson:
      params.kind === "st_base" ? safeJsonStringify(params.stBase) : null,
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getInstructionById(id);
  if (!created) {
    if (params.kind === "basic") {
      return {
        id,
        ownerId: resolveTrustedOwnerId(params.ownerId),
        name: params.name,
        kind: "basic",
        engine: params.engine ?? "liquidjs",
        templateText: params.templateText,
        meta: params.meta ?? null,
        createdAt: ts,
        updatedAt: ts,
      };
    }

    return {
      id,
      ownerId: resolveTrustedOwnerId(params.ownerId),
      name: params.name,
      kind: "st_base",
      engine: params.engine ?? "liquidjs",
      stBase: params.stBase,
      meta: params.meta ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return created;
}

export async function updateInstruction(params: {
  id: string;
  kind: InstructionKind;
  name?: string;
  engine?: "liquidjs";
  templateText?: string;
  stBase?: StBaseConfig;
  meta?: InstructionMeta;
}): Promise<InstructionDto | null> {
  const db = await initDb();
  const ts = new Date();

  const current = await getInstructionById(params.id);
  if (!current) return null;
  if (current.kind !== params.kind) {
    throw new Error(
      `Instruction ${params.id} kind mismatch: expected ${current.kind}, got ${params.kind}`
    );
  }

  const set: Partial<typeof instructions.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.engine === "string") set.engine = params.engine;
  if (params.kind === "basic" && typeof params.templateText === "string") {
    set.templateText = params.templateText;
  }
  if (params.kind === "st_base" && typeof params.stBase !== "undefined") {
    set.stBaseJson = safeJsonStringify(params.stBase);
  }

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
  const ownerId = resolveTrustedOwnerId(params.ownerId);

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
