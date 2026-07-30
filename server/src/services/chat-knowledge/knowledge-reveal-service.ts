import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { getKnowledgeRecordAccessState, upsertKnowledgeAccessState } from "./knowledge-access-repository";
import { evaluateKnowledgeGate } from "./knowledge-gate-policy";
import {
  findKnowledgeRecordsByKeys,
  getScopedKnowledgeRecordsByIds,
} from "./knowledge-records-repository";

import type {
  KnowledgeRecordDto,
  KnowledgeRevealRequest,
  KnowledgeRevealResult,
} from "@shared/types/chat-knowledge";

async function resolveTargetRecords(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  request: KnowledgeRevealRequest;
}): Promise<KnowledgeRecordDto[]> {
  const byId = await getScopedKnowledgeRecordsByIds({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    ids: params.request.recordIds ?? [],
  });
  const byKey = await findKnowledgeRecordsByKeys({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    keys: params.request.recordKeys ?? [],
  });
  const seen = new Set<string>();
  return [...byId, ...byKey].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function canRevealRecord(params: {
  ownerId: string;
  chatId: string;
  branchId: string | null;
  record: KnowledgeRecordDto;
  request: KnowledgeRevealRequest;
}): Promise<boolean> {
  const gate = params.record.gatePolicy?.read ?? params.record.gatePolicy?.prompt;
  if (!gate) return true;
  return evaluateKnowledgeGate({
    record: params.record,
    gate,
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    context: params.request.context,
  });
}

export async function revealKnowledgeRecords(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  request: KnowledgeRevealRequest;
}): Promise<KnowledgeRevealResult> {
  const ownerId = resolveTrustedOwnerId(params.ownerId);
  const targetRecords = await resolveTargetRecords(params);
  const targetIds = new Set(targetRecords.map((item) => item.id));
  const missingIds = (params.request.recordIds ?? []).filter((item) => !targetIds.has(item));

  const results: KnowledgeRevealResult["results"] = [];
  for (const missing of missingIds) {
    results.push({
      recordId: missing,
      status: "not_found",
      reason: "record_not_found",
    });
  }

  for (const record of targetRecords) {
    const allowed = await canRevealRecord({
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      record,
      request: params.request,
    });
    if (!allowed) {
      results.push({
        recordId: record.id,
        status: "blocked",
        reason: "gate_policy_blocked",
      });
      continue;
    }
    const current = await getKnowledgeRecordAccessState({
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      recordId: record.id,
    });
    await upsertKnowledgeAccessState({
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      recordId: record.id,
      discoverState: "visible",
      readState: "full",
      promptState: "allowed",
      revealState: "revealed",
      revealedAt: new Date(),
      revealedBy: params.request.revealedBy ?? current?.revealedBy ?? "system",
      revealReason: params.request.reason ?? current?.revealReason ?? null,
      flags: current?.flags ?? {},
    });
    results.push({
      recordId: record.id,
      status: "revealed",
      reason: current?.revealReason ?? null,
    });
  }

  return { results };
}
