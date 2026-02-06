import type { OperationHook, OperationProfile } from "@shared/types/operation-profiles";

import { RunArtifactStore } from "../artifacts/run-artifact-store";
import type {
  ArtifactValue,
  CommitPhaseReport,
  OperationExecutionResult,
  RuntimeEffect,
  RunState,
  UserTurnTarget,
} from "../contracts";
import { applyArtifactEffect } from "./effect-handlers/artifact-effects";
import { applyPromptEffect } from "./effect-handlers/prompt-effects";
import { persistUserTurnText } from "./effect-handlers/turn-effects";
import { validateEffectForHook } from "./effect-policy";

type CommitOrderNode = {
  opId: string;
  order: number;
  dependsOn: string[];
};

function compareNodes(a: CommitOrderNode, b: CommitOrderNode): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.opId.localeCompare(b.opId);
}

function resolveDeterministicCommitOrder(
  doneResults: OperationExecutionResult[]
): OperationExecutionResult[] {
  const byId = new Map(doneResults.map((item) => [item.opId, item] as const));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const result of doneResults) {
    indegree.set(result.opId, 0);
    dependents.set(result.opId, []);
  }

  for (const result of doneResults) {
    for (const depId of result.dependsOn) {
      if (!byId.has(depId)) continue;
      indegree.set(result.opId, (indegree.get(result.opId) ?? 0) + 1);
      dependents.get(depId)?.push(result.opId);
    }
  }

  const queue = doneResults
    .filter((item) => (indegree.get(item.opId) ?? 0) === 0)
    .map((item) => ({ opId: item.opId, order: item.order, dependsOn: item.dependsOn }))
    .sort(compareNodes);

  const resolved: OperationExecutionResult[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    const result = byId.get(node.opId);
    if (!result) continue;
    resolved.push(result);

    for (const dependentId of dependents.get(node.opId) ?? []) {
      const next = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, next);
      if (next === 0) {
        const depResult = byId.get(dependentId);
        if (!depResult) continue;
        queue.push({
          opId: depResult.opId,
          order: depResult.order,
          dependsOn: depResult.dependsOn,
        });
        queue.sort(compareNodes);
      }
    }
  }

  if (resolved.length === doneResults.length) return resolved;

  // Fallback for unexpected graph anomalies: keep deterministic stable order.
  return doneResults.slice().sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.opId.localeCompare(b.opId);
  });
}

export async function commitEffectsPhase(params: {
  hook: OperationHook;
  ownerId: string;
  chatId: string;
  branchId: string;
  profile: OperationProfile | null;
  sessionKey: string | null;
  runState: RunState;
  runArtifactStore: RunArtifactStore;
  userTurnTarget?: UserTurnTarget;
  onCommitEvent?: (event: {
    type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
    data: { hook: OperationHook; opId: string; effectType: RuntimeEffect["type"]; message?: string };
  }) => void;
}): Promise<{ report: CommitPhaseReport; requiredError: boolean }> {
  const results = params.runState.operationResultsByHook[params.hook] ?? [];
  const doneResults = results.filter((item) => item.status === "done");
  const orderedDoneResults = resolveDeterministicCommitOrder(doneResults);
  const effectsReport: CommitPhaseReport["effects"] = [];

  let requiredError = false;
  for (const opResult of orderedDoneResults) {
    for (const effect of opResult.effects) {
      const policy = validateEffectForHook({ hook: params.hook, effect });
      if (!policy.ok) {
        effectsReport.push({
          opId: opResult.opId,
          effectType: effect.type,
          status: "error",
          message: policy.message,
        });
        params.onCommitEvent?.({
          type: "commit.effect_error",
          data: {
            hook: params.hook,
            opId: opResult.opId,
            effectType: effect.type,
            message: policy.message,
          },
        });
        if (opResult.required) requiredError = true;
        continue;
      }

      try {
        if (
          effect.type === "prompt.system_update" ||
          effect.type === "prompt.append_after_last_user" ||
          effect.type === "prompt.insert_at_depth"
        ) {
          params.runState.effectivePromptDraft = applyPromptEffect(
            params.runState.effectivePromptDraft,
            effect
          );
          effectsReport.push({
            opId: opResult.opId,
            effectType: effect.type,
            status: "applied",
          });
          params.onCommitEvent?.({
            type: "commit.effect_applied",
            data: { hook: params.hook, opId: opResult.opId, effectType: effect.type },
          });
          continue;
        }

        if (effect.type === "artifact.upsert") {
          const applied = await applyArtifactEffect({
            ownerId: params.ownerId,
            chatId: params.chatId,
            branchId: params.branchId,
            sessionKey: params.sessionKey,
            profile: params.profile,
            runStore: params.runArtifactStore,
            effect,
          });
          if (applied.persistence === "persisted") {
            params.runState.persistedArtifactsSnapshot[effect.tag] = applied;
          }
          effectsReport.push({
            opId: opResult.opId,
            effectType: effect.type,
            status: "applied",
          });
          params.onCommitEvent?.({
            type: "commit.effect_applied",
            data: { hook: params.hook, opId: opResult.opId, effectType: effect.type },
          });
          continue;
        }

        if (effect.type === "turn.user.replace_text") {
          await persistUserTurnText({
            target: params.userTurnTarget,
            text: effect.text,
          });
          effectsReport.push({
            opId: opResult.opId,
            effectType: effect.type,
            status: "applied",
          });
          params.onCommitEvent?.({
            type: "commit.effect_applied",
            data: { hook: params.hook, opId: opResult.opId, effectType: effect.type },
          });
          continue;
        }

        params.runState.assistantText = effect.text;
        effectsReport.push({
          opId: opResult.opId,
          effectType: effect.type,
          status: "applied",
        });
        params.onCommitEvent?.({
          type: "commit.effect_applied",
          data: { hook: params.hook, opId: opResult.opId, effectType: effect.type },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        effectsReport.push({
          opId: opResult.opId,
          effectType: effect.type,
          status: "error",
          message,
        });
        params.onCommitEvent?.({
          type: "commit.effect_error",
          data: {
            hook: params.hook,
            opId: opResult.opId,
            effectType: effect.type,
            message,
          },
        });
        if (opResult.required) requiredError = true;
      }
    }
  }

  params.runState.runArtifacts = params.runArtifactStore.snapshot();
  const report: CommitPhaseReport = {
    hook: params.hook,
    status: requiredError ? "error" : "done",
    effects: effectsReport,
  };

  return { report, requiredError };
}
