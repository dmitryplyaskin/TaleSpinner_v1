import { eq } from "drizzle-orm";

import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { initDb } from "../../db/client";
import { uiSidebarsState } from "../../db/schema";
import { type SidebarState } from "../../types";

function safeParseState(json: string): SidebarState {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SidebarState;
  } catch {
    return {};
  }
}

export async function getSidebarsState(): Promise<SidebarState> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(uiSidebarsState)
    .where(eq(uiSidebarsState.id, resolveTrustedOwnerId()));

  const row = rows[0];
  if (!row) return {};
  return safeParseState(row.stateJson);
}

export async function saveSidebarsState(state: SidebarState): Promise<SidebarState> {
  const db = await initDb();
  const ts = new Date();
  const stateJson = JSON.stringify(state ?? {});

  await db
    .insert(uiSidebarsState)
    .values({ id: resolveTrustedOwnerId(), stateJson, updatedAt: ts })
    .onConflictDoUpdate({
      target: uiSidebarsState.id,
      set: { stateJson, updatedAt: ts },
    });

  return state;
}

