import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../../chat-core/json";
import { initDb } from "../../../db/client";
import { operationProfileSessionArtifacts } from "../../../db/schema";

import type {
  ArtifactSemantics,
  ArtifactUsage,
  OperationProfile,
} from "@shared/types/operation-profiles";

import type { ArtifactValue } from "../contracts";

const MAX_HISTORY_ITEMS = 20;

function normalizeHistory(input: unknown, nextValue: string): string[] {
  const parsed = Array.isArray(input) ? input.filter((v): v is string => typeof v === "string") : [];
  return [...parsed, nextValue].slice(-MAX_HISTORY_ITEMS);
}

export class ProfileSessionArtifactStore {
  static async load(params: {
    ownerId: string;
    sessionKey: string;
  }): Promise<Record<string, ArtifactValue>> {
    const db = await initDb();
    const rows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.ownerId, params.ownerId),
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey)
        )
      );

    const out: Record<string, ArtifactValue> = {};
    for (const row of rows) {
      const usage = (row.usage ?? "internal") as ArtifactUsage;
      const semantics = (row.semantics ?? "intermediate") as ArtifactSemantics;
      const value = safeJsonParse<string>(row.valueJson, "");
      const history = safeJsonParse<string[]>(row.historyJson, []);
      out[row.tag] = {
        usage,
        semantics,
        persistence: "persisted",
        value,
        history: Array.isArray(history) ? history.filter((v) => typeof v === "string") : [],
      };
    }
    return out;
  }

  static async upsert(params: {
    ownerId: string;
    sessionKey: string;
    chatId: string;
    branchId: string;
    profile: OperationProfile | null;
    tag: string;
    usage: ArtifactUsage;
    semantics: ArtifactSemantics;
    value: string;
  }): Promise<ArtifactValue> {
    const db = await initDb();
    const existingRows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey),
          eq(operationProfileSessionArtifacts.tag, params.tag)
        )
      )
      .limit(1);

    const now = new Date();
    const existing = existingRows[0];
    const history = normalizeHistory(existing ? safeJsonParse(existing.historyJson, []) : [], params.value);

    if (existing) {
      await db
        .update(operationProfileSessionArtifacts)
        .set({
          usage: params.usage,
          semantics: params.semantics,
          valueJson: safeJsonStringify(params.value, "\"\""),
          historyJson: safeJsonStringify(history, "[]"),
          updatedAt: now,
        })
        .where(eq(operationProfileSessionArtifacts.id, existing.id));
    } else {
      await db.insert(operationProfileSessionArtifacts).values({
        id: uuidv4(),
        ownerId: params.ownerId,
        sessionKey: params.sessionKey,
        chatId: params.chatId,
        branchId: params.branchId,
        profileId: params.profile?.profileId ?? null,
        profileVersion: params.profile?.version ?? null,
        operationProfileSessionId: params.profile?.operationProfileSessionId ?? null,
        tag: params.tag,
        usage: params.usage,
        semantics: params.semantics,
        valueJson: safeJsonStringify(params.value, "\"\""),
        historyJson: safeJsonStringify(history, "[]"),
        updatedAt: now,
      });
    }

    return {
      usage: params.usage,
      semantics: params.semantics,
      persistence: "persisted",
      value: params.value,
      history,
    };
  }
}
