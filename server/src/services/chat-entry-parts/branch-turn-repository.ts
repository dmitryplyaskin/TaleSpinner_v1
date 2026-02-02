import { eq, sql } from "drizzle-orm";

import { initDb } from "../../db/client";
import { chatBranches } from "../../db/schema";

export async function getBranchCurrentTurn(params: { branchId: string }): Promise<number> {
  const db = await initDb();
  const rows = await db
    .select({ currentTurn: chatBranches.currentTurn })
    .from(chatBranches)
    .where(eq(chatBranches.id, params.branchId))
    .limit(1);
  return rows[0]?.currentTurn ?? 0;
}

export async function incrementBranchTurn(params: { branchId: string }): Promise<number> {
  const db = await initDb();

  // SQLite supports UPDATE ... RETURNING in modern versions; Drizzle uses it when available.
  const rows = await db
    .update(chatBranches)
    .set({ currentTurn: sql`${chatBranches.currentTurn} + 1` })
    .where(eq(chatBranches.id, params.branchId))
    .returning({ currentTurn: chatBranches.currentTurn });

  const current = rows[0]?.currentTurn;
  if (typeof current === "number") return current;

  // Fallback: select current turn if RETURNING is not supported.
  return await getBranchCurrentTurn({ branchId: params.branchId });
}

