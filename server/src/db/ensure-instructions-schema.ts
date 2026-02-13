import { sql } from "drizzle-orm";

import { initDb } from "./client";

type TableInfoRow = {
  name: string;
};

type IndexInfoRow = {
  name: string;
};

function quoteIdent(value: string): string {
  return `\`${value.replace(/`/g, "``")}\``;
}

async function tableExists(tableName: string): Promise<boolean> {
  const db = await initDb();
  const rows = await db.all<TableInfoRow>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${tableName} LIMIT 1`
  );
  return rows.length > 0;
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const db = await initDb();
  const rows = await db.all<{ name: string }>(
    sql.raw(`PRAGMA table_info(${quoteIdent(tableName)})`)
  );
  return rows.some((row) => row.name === columnName);
}

async function indexExists(indexName: string): Promise<boolean> {
  const db = await initDb();
  const rows = await db.all<IndexInfoRow>(
    sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ${indexName} LIMIT 1`
  );
  return rows.length > 0;
}

/**
 * Ensures DB is compatible with the instructions-only schema after full cutover.
 *
 * This is a one-time bootstrap safeguard for installations where migration history
 * is already marked as applied but local SQLite objects are still old.
 */
export async function ensureInstructionsSchema(): Promise<void> {
  const db = await initDb();

  const hasInstructionsTable = await tableExists("instructions");
  const hasPromptTemplatesTable = await tableExists("prompt_templates");

  if (!hasInstructionsTable && hasPromptTemplatesTable) {
    await db.run(sql.raw("ALTER TABLE `prompt_templates` RENAME TO `instructions`;"));
  }

  if (!(await tableExists("instructions"))) {
    await db.run(
      sql.raw(
        "CREATE TABLE IF NOT EXISTS `instructions` (" +
          "`id` text PRIMARY KEY NOT NULL," +
          "`owner_id` text DEFAULT 'global' NOT NULL," +
          "`name` text NOT NULL," +
          "`engine` text DEFAULT 'liquidjs' NOT NULL," +
          "`template_text` text NOT NULL," +
          "`meta_json` text," +
          "`created_at` integer NOT NULL," +
          "`updated_at` integer NOT NULL" +
        ");"
      )
    );
  }

  if (!(await indexExists("instructions_owner_updated_at_idx"))) {
    await db.run(
      sql.raw(
        "CREATE INDEX IF NOT EXISTS `instructions_owner_updated_at_idx` ON `instructions` (`owner_id`,`updated_at`);"
      )
    );
  }
  if (await indexExists("prompt_templates_owner_updated_at_idx")) {
    await db.run(sql.raw("DROP INDEX IF EXISTS `prompt_templates_owner_updated_at_idx`;"));
  }

  const hasInstructionId = await columnExists("chats", "instruction_id");
  const hasPromptTemplateId = await columnExists("chats", "prompt_template_id");

  if (!hasInstructionId && hasPromptTemplateId) {
    await db.run(sql.raw("ALTER TABLE `chats` RENAME COLUMN `prompt_template_id` TO `instruction_id`;"));
  } else if (!hasInstructionId && !hasPromptTemplateId) {
    await db.run(sql.raw("ALTER TABLE `chats` ADD COLUMN `instruction_id` text;"));
  }

  if ((await columnExists("chats", "instruction_id")) && (await columnExists("chats", "prompt_template_id"))) {
    await db.run(
      sql.raw(
        "UPDATE `chats` SET `instruction_id` = COALESCE(`instruction_id`, `prompt_template_id`) WHERE `instruction_id` IS NULL;"
      )
    );
  }
}
