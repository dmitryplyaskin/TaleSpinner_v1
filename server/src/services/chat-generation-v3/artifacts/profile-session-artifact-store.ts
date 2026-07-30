import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { safeJsonParse, safeJsonStringify } from "../../../chat-core/json";
import { resolveTrustedOwnerId } from "../../../core/request-context/owner-scope-storage";
import { initDb } from "../../../db/client";
import { operationProfileSessionArtifacts } from "../../../db/schema";
import {
  assertArtifactHistoryItemLimit,
  assertArtifactHistoryWithinLimits,
  assertArtifactValueWithinLimits,
} from "../../operations/operation-resource-limits";

import type { ArtifactValue } from "../contracts";
import type { OperationActivationState } from "../operations/operation-activation-intervals";
import type {
  ArtifactFormat,
  ArtifactSemantics,
  ArtifactWriteMode,
  OperationProfile,
} from "@shared/types/operation-profiles";

const INTERNAL_OPERATION_ACTIVATION_TAG_PREFIX = "__sys_op_activation__:";

function normalizeHistory(input: unknown, nextValue: unknown, maxItems: number): unknown[] {
  const parsed = Array.isArray(input) ? input : [];
  return [...parsed, nextValue].slice(-maxItems);
}

function normalizeActivationState(input: unknown): OperationActivationState {
  if (!input || typeof input !== "object") {
    return { turnsCounter: 0, tokensCounter: 0 };
  }
  const state = input as Record<string, unknown>;
  const toInt = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return {
    turnsCounter: toInt(state.turnsCounter),
    tokensCounter: toInt(state.tokensCounter),
  };
}

export function buildOperationActivationStateTag(opId: string): string {
  return `${INTERNAL_OPERATION_ACTIVATION_TAG_PREFIX}${encodeURIComponent(opId)}`;
}

export class ProfileSessionArtifactStore {
  static async load(params: {
    ownerId: string;
    sessionKey: string;
  }): Promise<Record<string, ArtifactValue>> {
    const db = await initDb();
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const rows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.ownerId, ownerId),
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey)
        )
      );

    const out: Record<string, ArtifactValue> = {};
    for (const row of rows) {
      if (row.tag.startsWith(INTERNAL_OPERATION_ACTIVATION_TAG_PREFIX)) continue;
      const format = ((row.usage ?? "markdown") as ArtifactFormat) || "markdown";
      const semantics = (row.semantics ?? "intermediate") as ArtifactSemantics;
      const value = safeJsonParse<unknown>(row.valueJson, "");
      const history = safeJsonParse<unknown[]>(row.historyJson, []);
      out[row.tag] = {
        format,
        semantics,
        persistence: "persisted",
        writeMode: "replace",
        value,
        history: Array.isArray(history) ? history : [],
      };
    }
    return out;
  }

  static async loadOperationActivationStates(params: {
    ownerId: string;
    sessionKey: string;
    opIds: string[];
  }): Promise<Record<string, OperationActivationState>> {
    const opIds = Array.from(new Set(params.opIds.filter((opId) => opId.trim().length > 0)));
    if (opIds.length === 0) return {};
    const db = await initDb();
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const tagByOpId = new Map(opIds.map((opId) => [opId, buildOperationActivationStateTag(opId)]));
    const rows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.ownerId, ownerId),
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey),
          inArray(operationProfileSessionArtifacts.tag, Array.from(tagByOpId.values()))
        )
      );

    const opIdByTag = new Map(Array.from(tagByOpId.entries()).map(([opId, tag]) => [tag, opId]));
    const out: Record<string, OperationActivationState> = {};
    for (const row of rows) {
      const opId = opIdByTag.get(row.tag);
      if (!opId) continue;
      out[opId] = normalizeActivationState(safeJsonParse<unknown>(row.valueJson, null));
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
    format: ArtifactFormat;
    semantics: ArtifactSemantics;
    writeMode: ArtifactWriteMode;
    history: {
      enabled: boolean;
      maxItems: number;
    };
    value: unknown;
  }): Promise<ArtifactValue> {
    assertArtifactValueWithinLimits(params.value);
    assertArtifactHistoryItemLimit(params.history.maxItems);
    const db = await initDb();
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const existingRows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.ownerId, ownerId),
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey),
          eq(operationProfileSessionArtifacts.tag, params.tag)
        )
      )
      .limit(1);

    const now = new Date();
    const existing = existingRows[0];
    const history = params.history.enabled
      ? normalizeHistory(
          existing ? safeJsonParse(existing.historyJson, []) : [],
          params.value,
          params.history.maxItems
        )
      : [];
    assertArtifactHistoryWithinLimits(history);

    if (existing) {
      await db
        .update(operationProfileSessionArtifacts)
        .set({
          usage: params.format,
          semantics: params.semantics,
          valueJson: safeJsonStringify(params.value, "null"),
          historyJson: safeJsonStringify(history, "[]"),
          updatedAt: now,
        })
        .where(
          and(
            eq(operationProfileSessionArtifacts.id, existing.id),
            eq(operationProfileSessionArtifacts.ownerId, ownerId)
          )
        );
    } else {
      await db.insert(operationProfileSessionArtifacts).values({
        id: uuidv4(),
        ownerId,
        sessionKey: params.sessionKey,
        chatId: params.chatId,
        branchId: params.branchId,
        profileId: params.profile?.profileId ?? null,
        profileVersion: params.profile?.version ?? null,
        operationProfileSessionId: params.profile?.operationProfileSessionId ?? null,
        tag: params.tag,
        usage: params.format,
        semantics: params.semantics,
        valueJson: safeJsonStringify(params.value, "null"),
        historyJson: safeJsonStringify(history, "[]"),
        updatedAt: now,
      });
    }

    return {
      format: params.format,
      semantics: params.semantics,
      persistence: "persisted",
      writeMode: params.writeMode,
      value: params.value,
      history,
    };
  }

  static async upsertOperationActivationState(params: {
    ownerId: string;
    sessionKey: string;
    chatId: string;
    branchId: string;
    profile: OperationProfile | null;
    opId: string;
    state: OperationActivationState;
  }): Promise<void> {
    const db = await initDb();
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const tag = buildOperationActivationStateTag(params.opId);
    const existingRows = await db
      .select()
      .from(operationProfileSessionArtifacts)
      .where(
        and(
          eq(operationProfileSessionArtifacts.ownerId, ownerId),
          eq(operationProfileSessionArtifacts.sessionKey, params.sessionKey),
          eq(operationProfileSessionArtifacts.tag, tag)
        )
      )
      .limit(1);

    const now = new Date();
    if (existingRows[0]) {
      await db
        .update(operationProfileSessionArtifacts)
        .set({
          valueJson: safeJsonStringify(params.state, "{}"),
          updatedAt: now,
        })
        .where(
          and(
            eq(operationProfileSessionArtifacts.id, existingRows[0].id),
            eq(operationProfileSessionArtifacts.ownerId, ownerId)
          )
        );
      return;
    }

    await db.insert(operationProfileSessionArtifacts).values({
      id: uuidv4(),
      ownerId,
      sessionKey: params.sessionKey,
      chatId: params.chatId,
      branchId: params.branchId,
      profileId: params.profile?.profileId ?? null,
      profileVersion: params.profile?.version ?? null,
      operationProfileSessionId: params.profile?.operationProfileSessionId ?? null,
      tag,
      usage: "json",
      semantics: "state",
      valueJson: safeJsonStringify(params.state, "{}"),
      historyJson: "[]",
      updatedAt: now,
    });
  }
}
