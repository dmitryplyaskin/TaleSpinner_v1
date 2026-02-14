import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { initDb } from "./client";
import { validateOperationBlockUpsertInput } from "../services/operations/operation-block-validator";

type SqliteMasterRow = { name: string };
type ProfileRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  spec_json: string;
  meta_json: string | null;
  created_at: number;
  version: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeParseJson(value: string | null): unknown {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function tableExists(tableName: string): Promise<boolean> {
  const db = await initDb();
  const rows = await db.all<SqliteMasterRow>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${tableName} LIMIT 1`
  );
  return rows.length > 0;
}

export async function ensureOperationBlocksCutover(): Promise<void> {
  const db = await initDb();
  const hasProfiles = await tableExists("operation_profiles");
  const hasBlocks = await tableExists("operation_blocks");
  if (!hasProfiles || !hasBlocks) return;

  const rows = await db.all<ProfileRow>(sql.raw(
    "SELECT `id`, `owner_id`, `name`, `description`, `spec_json`, `meta_json`, `created_at`, `version` FROM `operation_profiles`"
  ));

  for (const row of rows) {
    const specRaw = safeParseJson(row.spec_json);
    if (!isRecord(specRaw)) continue;
    if (Array.isArray(specRaw.blockRefs)) continue;

    const operationsRaw = Array.isArray(specRaw.operations) ? specRaw.operations : [];
    const profileMetaRaw = safeParseJson(row.meta_json);
    const profileMeta = isRecord(profileMetaRaw) ? { ...profileMetaRaw } : {};
    const nodeEditorMeta = profileMeta.nodeEditor;
    if ("nodeEditor" in profileMeta) delete profileMeta.nodeEditor;

    let newBlockRefs: Array<{ blockId: string; enabled: boolean; order: number }> = [];
    if (operationsRaw.length > 0) {
      const validatedBlock = validateOperationBlockUpsertInput({
        name: `${row.name} block`,
        description: row.description ?? undefined,
        enabled: true,
        operations: operationsRaw,
        meta: nodeEditorMeta ? { nodeEditor: nodeEditorMeta } : undefined,
      });
      const blockId = randomUUID();
      const nowMs = Date.now();
      await db.run(sql`
        INSERT INTO operation_blocks
          (id, owner_id, name, description, enabled, version, spec_json, meta_json, created_at, updated_at)
        VALUES
          (
            ${blockId},
            ${row.owner_id},
            ${validatedBlock.name},
            ${validatedBlock.description ?? null},
            ${1},
            ${1},
            ${JSON.stringify({ operations: validatedBlock.operations })},
            ${validatedBlock.meta === null ? null : JSON.stringify(validatedBlock.meta)},
            ${row.created_at},
            ${nowMs}
          )
      `);
      newBlockRefs = [{ blockId, enabled: true, order: 0 }];
    }

    const nowMs = Date.now();
    await db.run(sql`
      UPDATE operation_profiles
      SET
        spec_json = ${JSON.stringify({ blockRefs: newBlockRefs })},
        meta_json = ${Object.keys(profileMeta).length > 0 ? JSON.stringify(profileMeta) : null},
        version = ${row.version + 1},
        updated_at = ${nowMs}
      WHERE id = ${row.id}
    `);
  }
}
