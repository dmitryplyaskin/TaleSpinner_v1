import { eq } from "drizzle-orm";

import { initDb } from "../../db/client";
import { uiSidebarsState } from "../../db/schema";
import { type SidebarState } from "../../types";

const SIDEBARS_STATE_ID = "global";

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
    .where(eq(uiSidebarsState.id, SIDEBARS_STATE_ID));

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
    .values({ id: SIDEBARS_STATE_ID, stateJson, updatedAt: ts })
    .onConflictDoUpdate({
      target: uiSidebarsState.id,
      set: { stateJson, updatedAt: ts },
    });

  return state;
}

