import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import {
  decryptSecret,
  encryptSecret,
  maskToken,
} from "@core/crypto/secret-box";

import { initDb, type Db } from "../../db/client";
import {
  llmProviderConfigs,
  llmProviders,
  llmRuntimeProviderState,
  llmRuntimeSettings,
  llmTokens,
} from "../../db/schema";

import { type LlmProviderId, llmProviderDefinitions } from "./llm-definitions";

export type LlmScope = "global" | "agent";

export type LlmRuntimeRow = {
  scope: LlmScope;
  scopeId: string;
  activeProviderId: LlmProviderId;
  activeTokenId: string | null;
  activeModel: string | null;
};

export type LlmTokenListItem = {
  id: string;
  providerId: LlmProviderId;
  name: string;
  tokenHint: string;
};

export type ProviderConfigRow = {
  providerId: LlmProviderId;
  config: unknown;
};

export type LlmRuntimeProviderStateRow = {
  scope: LlmScope;
  scopeId: string;
  providerId: LlmProviderId;
  lastTokenId: string | null;
  lastModel: string | null;
};

function nowDate(): Date {
  return new Date();
}

async function db(): Promise<Db> {
  return initDb();
}

export async function ensureDefaultProviders(): Promise<void> {
  const database = await db();
  const existing = await database.select().from(llmProviders);
  const existingIds = new Set(existing.map((p) => p.id));

  const ts = nowDate();
  const toInsert = llmProviderDefinitions
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabledByDefault,
      createdAt: ts,
      updatedAt: ts,
    }));

  if (toInsert.length > 0) {
    await database.insert(llmProviders).values(toInsert);
  }
}

export async function ensureDefaultRuntimeGlobal(): Promise<void> {
  const database = await db();
  const existing = await database
    .select()
    .from(llmRuntimeSettings)
    .where(
      and(
        eq(llmRuntimeSettings.scope, "global"),
        eq(llmRuntimeSettings.scopeId, "global")
      )
    );

  if (existing.length > 0) return;

  await database.insert(llmRuntimeSettings).values({
    scope: "global",
    scopeId: "global",
    activeProviderId: "openrouter",
    activeTokenId: null,
    activeModel: null,
    updatedAt: nowDate(),
  });
}

export async function listProviders(): Promise<
  Array<{ id: LlmProviderId; name: string; enabled: boolean }>
> {
  const database = await db();
  const rows = await database.select().from(llmProviders);
  return rows.map((r) => ({
    id: r.id as LlmProviderId,
    name: r.name,
    enabled: !!r.enabled,
  }));
}

export async function getRuntime(
  scope: LlmScope,
  scopeId: string
): Promise<LlmRuntimeRow> {
  const database = await db();
  const rows = await database
    .select()
    .from(llmRuntimeSettings)
    .where(
      and(
        eq(llmRuntimeSettings.scope, scope),
        eq(llmRuntimeSettings.scopeId, scopeId)
      )
    );

  if (rows[0]) {
    const r = rows[0];
    return {
      scope,
      scopeId,
      activeProviderId: r.activeProviderId as LlmProviderId,
      activeTokenId: r.activeTokenId ?? null,
      activeModel: r.activeModel ?? null,
    };
  }

  const fallback: LlmRuntimeRow = {
    scope,
    scopeId,
    activeProviderId: "openrouter",
    activeTokenId: null,
    activeModel: null,
  };

  await database.insert(llmRuntimeSettings).values({
    scope,
    scopeId,
    activeProviderId: fallback.activeProviderId,
    activeTokenId: null,
    activeModel: null,
    updatedAt: nowDate(),
  });

  return fallback;
}

export async function upsertRuntime(
  runtime: LlmRuntimeRow
): Promise<LlmRuntimeRow> {
  const database = await db();
  const ts = nowDate();

  await database
    .insert(llmRuntimeSettings)
    .values({
      scope: runtime.scope,
      scopeId: runtime.scopeId,
      activeProviderId: runtime.activeProviderId,
      activeTokenId: runtime.activeTokenId,
      activeModel: runtime.activeModel,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: [llmRuntimeSettings.scope, llmRuntimeSettings.scopeId],
      set: {
        activeProviderId: runtime.activeProviderId,
        activeTokenId: runtime.activeTokenId,
        activeModel: runtime.activeModel,
        updatedAt: ts,
      },
    });

  return runtime;
}

export async function getRuntimeProviderState(params: {
  scope: LlmScope;
  scopeId: string;
  providerId: LlmProviderId;
}): Promise<LlmRuntimeProviderStateRow> {
  const database = await db();
  const rows = await database
    .select()
    .from(llmRuntimeProviderState)
    .where(
      and(
        eq(llmRuntimeProviderState.scope, params.scope),
        eq(llmRuntimeProviderState.scopeId, params.scopeId),
        eq(llmRuntimeProviderState.providerId, params.providerId)
      )
    );

  const row = rows[0];
  if (!row) {
    return {
      scope: params.scope,
      scopeId: params.scopeId,
      providerId: params.providerId,
      lastTokenId: null,
      lastModel: null,
    };
  }
  return {
    scope: row.scope,
    scopeId: row.scopeId,
    providerId: row.providerId as LlmProviderId,
    lastTokenId: row.lastTokenId ?? null,
    lastModel: row.lastModel ?? null,
  };
}

export async function upsertRuntimeProviderState(
  params: LlmRuntimeProviderStateRow
): Promise<void> {
  const database = await db();
  const ts = nowDate();
  await database
    .insert(llmRuntimeProviderState)
    .values({
      scope: params.scope,
      scopeId: params.scopeId,
      providerId: params.providerId,
      lastTokenId: params.lastTokenId,
      lastModel: params.lastModel,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: [
        llmRuntimeProviderState.scope,
        llmRuntimeProviderState.scopeId,
        llmRuntimeProviderState.providerId,
      ],
      set: {
        lastTokenId: params.lastTokenId,
        lastModel: params.lastModel,
        updatedAt: ts,
      },
    });
}

export async function getProviderConfig(
  providerId: LlmProviderId
): Promise<ProviderConfigRow> {
  const database = await db();
  const rows = await database
    .select()
    .from(llmProviderConfigs)
    .where(eq(llmProviderConfigs.id, providerId));

  if (!rows[0]) {
    return { providerId, config: {} };
  }

  const config = JSON.parse(rows[0].configJson) as unknown;
  return { providerId, config };
}

export async function upsertProviderConfig(
  providerId: LlmProviderId,
  config: unknown
): Promise<ProviderConfigRow> {
  const database = await db();
  const ts = nowDate();
  const configJson = JSON.stringify(config ?? {});

  await database
    .insert(llmProviderConfigs)
    .values({
      id: providerId,
      providerId,
      configJson,
      createdAt: ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: llmProviderConfigs.id,
      set: { configJson, updatedAt: ts },
    });

  return { providerId, config };
}

export async function listTokens(
  providerId: LlmProviderId
): Promise<LlmTokenListItem[]> {
  const database = await db();
  const rows = await database
    .select()
    .from(llmTokens)
    .where(eq(llmTokens.providerId, providerId));
  return rows.map((r) => ({
    id: r.id,
    providerId: r.providerId as LlmProviderId,
    name: r.name,
    tokenHint: r.tokenHint,
  }));
}

export async function createToken(params: {
  providerId: LlmProviderId;
  name: string;
  token: string;
}): Promise<LlmTokenListItem> {
  const database = await db();
  const id = uuidv4();
  const ts = nowDate();
  const ciphertext = encryptSecret(params.token);
  const tokenHint = maskToken(params.token);

  await database.insert(llmTokens).values({
    id,
    providerId: params.providerId,
    name: params.name,
    ciphertext,
    tokenHint,
    createdAt: ts,
    updatedAt: ts,
    lastUsedAt: null,
  });

  return { id, providerId: params.providerId, name: params.name, tokenHint };
}

export async function updateToken(params: {
  id: string;
  name?: string;
  token?: string;
}): Promise<void> {
  const database = await db();
  const ts = nowDate();

  const set: Partial<typeof llmTokens.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") {
    set.name = params.name;
  }
  if (typeof params.token === "string" && params.token.trim()) {
    set.ciphertext = encryptSecret(params.token.trim());
    set.tokenHint = maskToken(params.token.trim());
  }

  await database.update(llmTokens).set(set).where(eq(llmTokens.id, params.id));
}

export async function deleteToken(id: string): Promise<void> {
  const database = await db();
  await database.delete(llmTokens).where(eq(llmTokens.id, id));
}

export async function getTokenPlaintext(id: string): Promise<string | null> {
  const database = await db();
  const rows = await database
    .select()
    .from(llmTokens)
    .where(eq(llmTokens.id, id));
  const row = rows[0];
  if (!row) return null;
  return decryptSecret(row.ciphertext);
}

export async function touchTokenLastUsed(id: string): Promise<void> {
  const database = await db();
  await database
    .update(llmTokens)
    .set({ lastUsedAt: nowDate(), updatedAt: nowDate() })
    .where(eq(llmTokens.id, id));
}
