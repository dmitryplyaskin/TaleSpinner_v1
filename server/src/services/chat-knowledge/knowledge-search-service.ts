import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { knowledgeRecords } from "../../db/schema";

import { getKnowledgeRecordAccessState } from "./knowledge-access-repository";
import { getDefaultAccessSnapshot } from "./knowledge-gate-policy";
import { rowToKnowledgeRecordDto } from "./knowledge-helpers";

import type {
  KnowledgeRecordDto,
  KnowledgeSearchHit,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
} from "@shared/types/chat-knowledge";

function buildBranchScope(branchId: string | null) {
  return branchId === null
    ? isNull(knowledgeRecords.branchId)
    : or(isNull(knowledgeRecords.branchId), eq(knowledgeRecords.branchId, branchId));
}

function normalizeTokens(input: string | undefined): string[] {
  if (!input) return [];
  return Array.from(new Set((input.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter(Boolean)));
}

function normalizeFtsQuery(tokens: string[]): string {
  return tokens.map((token) => `${token.replace(/"/g, "")}*`).join(" OR ");
}

function countTokenMatches(record: KnowledgeRecordDto, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = `${record.title} ${record.aliases.join(" ")} ${record.tags.join(" ")} ${
    record.summary ?? ""
  } ${record.searchText}`.toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function buildMatchReasons(params: {
  record: KnowledgeRecordDto;
  request: KnowledgeSearchRequest;
  textScore: number;
}): string[] {
  const reasons: string[] = [];
  if (params.request.keys?.includes(params.record.key)) reasons.push("key_exact");
  if (
    params.request.titles?.some((item) => item.toLowerCase() === params.record.title.toLowerCase())
  ) {
    reasons.push("title_exact");
  }
  if (
    params.request.aliases?.some((item) =>
      params.record.aliases.some((alias) => alias.toLowerCase() === item.toLowerCase())
    )
  ) {
    reasons.push("alias_exact");
  }
  if (
    params.request.tags?.some((item) =>
      params.record.tags.some((tag) => tag.toLowerCase() === item.toLowerCase())
    )
  ) {
    reasons.push("tag_match");
  }
  if (params.textScore > 0) reasons.push("fts");
  return reasons;
}

function buildPreview(record: KnowledgeRecordDto) {
  return {
    title: record.title,
    summary: record.summary,
    aliases: record.aliases,
    tags: record.tags,
    recordType: record.recordType,
  };
}

async function getFtsScores(params: {
  ids: string[];
  textQuery?: string;
}): Promise<Map<string, number>> {
  if (params.ids.length === 0 || !params.textQuery?.trim()) return new Map();
  const db = await initDb();
  const tokens = normalizeTokens(params.textQuery);
  if (tokens.length === 0) return new Map();
  const idsSql = params.ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
  const raw = await db.all<{ record_id: string; rank: number }>(sql.raw(`
    SELECT record_id, bm25(knowledge_records_fts) AS rank
    FROM knowledge_records_fts
    WHERE knowledge_records_fts MATCH '${normalizeFtsQuery(tokens).replace(/'/g, "''")}'
      AND record_id IN (${idsSql})
  `));
  const out = new Map<string, number>();
  for (const row of raw) {
    out.set(row.record_id, row.rank < 0 ? Math.abs(row.rank) : row.rank);
  }
  return out;
}

function computeExactScore(params: {
  record: KnowledgeRecordDto;
  request: KnowledgeSearchRequest;
}): number {
  let score = 0;
  if (params.request.keys?.includes(params.record.key)) score += 120;
  if (
    params.request.titles?.some((item) => item.toLowerCase() === params.record.title.toLowerCase())
  ) {
    score += 100;
  }
  if (
    params.request.aliases?.some((item) =>
      params.record.aliases.some((alias) => alias.toLowerCase() === item.toLowerCase())
    )
  ) {
    score += 80;
  }
  const tagMatches =
    params.request.tags?.filter((item) =>
      params.record.tags.some((tag) => tag.toLowerCase() === item.toLowerCase())
    ).length ?? 0;
  score += tagMatches * 20;
  return score;
}

export async function searchKnowledgeRecords(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  request: KnowledgeSearchRequest;
}): Promise<KnowledgeSearchResult> {
  const db = await initDb();
  const where = [
    eq(knowledgeRecords.ownerId, resolveTrustedOwnerId(params.ownerId)),
    eq(knowledgeRecords.chatId, params.chatId),
    buildBranchScope(params.branchId),
    eq(knowledgeRecords.status, "active"),
  ];
  if (!params.request.includeHiddenCandidates) {
    where.push(inArray(knowledgeRecords.accessMode, ["public", "discoverable"]));
  }
  if (params.request.collectionIds?.length) {
    where.push(inArray(knowledgeRecords.collectionId, params.request.collectionIds));
  }
  if (params.request.recordTypes?.length) {
    where.push(inArray(knowledgeRecords.recordType, params.request.recordTypes));
  }
  const rows = await db.select().from(knowledgeRecords).where(and(...where));
  const records = rows.map(rowToKnowledgeRecordDto);
  const ftsScores = await getFtsScores({
    ids: records.map((item) => item.id),
    textQuery: params.request.textQuery,
  });
  const tokens = normalizeTokens(params.request.textQuery);
  const hits: KnowledgeSearchHit[] = [];

  for (const record of records) {
    if (record.accessMode === "internal") continue;
    const defaultAccess = getDefaultAccessSnapshot(record.accessMode);
    const accessState =
      (await getKnowledgeRecordAccessState({
        ownerId: params.ownerId,
        chatId: params.chatId,
        branchId: params.branchId,
        recordId: record.id,
      })) ?? null;
    const matchedTokens = countTokenMatches(record, tokens);
    const minimumShouldMatch = Math.max(0, params.request.minimumShouldMatch ?? 0);
    if (minimumShouldMatch > 0 && matchedTokens < minimumShouldMatch) continue;

    const exactScore = computeExactScore({ record, request: params.request });
    const textScore = ftsScores.has(record.id)
      ? Math.max(0, 30 - Math.min(30, ftsScores.get(record.id)!))
      : 0;
    const score = exactScore + textScore + matchedTokens * 2;
    if (score <= 0 && tokens.length > 0) continue;
    if (typeof params.request.minScore === "number" && score < params.request.minScore) continue;

    const visibility =
      accessState?.readState === "full" || defaultAccess.readState === "full" ? "full" : "preview";

    hits.push({
      recordId: record.id,
      score,
      matchReasons: buildMatchReasons({ record, request: params.request, textScore }),
      visibility,
      preview: buildPreview(record),
      record: visibility === "full" ? record : null,
    });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.recordId.localeCompare(b.recordId);
  });

  return {
    hits: hits.slice(0, Math.max(1, Math.min(200, params.request.limit ?? 10))),
  };
}
