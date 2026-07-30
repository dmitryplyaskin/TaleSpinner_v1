import { createTaskSkip, runOrchestrator } from "@core/operation-orchestrator";

import { renderLiquidTemplate } from "../../chat-core/prompt-template-renderer";
import {
  assertArtifactValueWithinLimits,
  OPERATION_RESOURCE_LIMITS,
} from "../../operations/operation-resource-limits";
import {
  compileArtifactExposureEffect,
  getArtifactPrimaryEffectType,
  type OperationFinishedEventData,
  type OperationExecutionResult,
  type OperationSkipDetails,
  type OperationSkipReason,
  type PromptDraftMessage,
  type RuntimeEffect,
} from "../contracts";

import { applyPromptEffect } from "./effect-handlers/prompt-effects";
import { executeGuardOperation } from "./guard-operation-executor";
import { evaluateGuardRunConditions } from "./guard-run-conditions";
import { executeKnowledgeOperation } from "./knowledge-operation-executor";
import { executeLlmOperation } from "./llm-operation-executor";
import { toSafeOperationError } from "./operation-error";

import type { TaskResult } from "../../../core/operation-orchestrator/types";
import type { InstructionRenderContext } from "../../chat-core/prompt-template-renderer";
import type { OperationHook, OperationInProfile, OperationTrigger } from "@shared/types/operation-profiles";

type PreviewState = {
  messages: PromptDraftMessage[];
  artifacts: Record<string, { value: unknown; history: unknown[] }>;
  assistantText: string;
};

function getRuntimeArtifactKey(params: {
  artifactId: string;
  tag: string;
}): string {
  return params.tag;
}

function readArtifactValue(params: {
  artifacts: Record<string, { value: unknown; history: unknown[] }>;
  artifactId: string;
  tag: string;
}): { value: unknown; history: unknown[] } | undefined {
  return (
    params.artifacts[getRuntimeArtifactKey(params)] ??
    params.artifacts[params.artifactId]
  );
}

function resolvePromptSystem(messages: PromptDraftMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .filter((content) => content.trim().length > 0)
    .join("\n\n");
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function clonePreview(state: PreviewState): PreviewState {
  return {
    messages: state.messages.map((m) => ({ ...m })),
    artifacts: Object.fromEntries(
      Object.entries(state.artifacts).map(([tag, value]) => [
        tag,
        { value: value.value, history: [...value.history] },
      ])
    ),
    assistantText: state.assistantText,
  };
}

function applyEffectToPreview(state: PreviewState, effect: RuntimeEffect): PreviewState {
  if (
    effect.type === "prompt.system_update" ||
    effect.type === "prompt.append_after_last_user" ||
    effect.type === "prompt.insert_at_depth"
  ) {
    return { ...state, messages: applyPromptEffect(state.messages, effect) };
  }

  if (effect.type === "artifact.upsert") {
    const existing = state.artifacts[effect.artifactId];
    const nextHistory = [...(existing?.history ?? []), effect.value];
    const history = effect.history.enabled
      ? nextHistory.slice(-effect.history.maxItems)
      : [];
    return {
      ...state,
      artifacts: {
        ...state.artifacts,
        [effect.artifactId]: {
          value: effect.value,
          history,
        },
      },
    };
  }

  if (effect.type === "turn.assistant.replace_text") {
    return {
      ...state,
      assistantText: effect.text,
    };
  }

  const lastUserIdx = state.messages.map((m) => m.role).lastIndexOf("user");
  if (lastUserIdx < 0) return state;
  if (effect.type === "ui.inline") return state;
  const nextMessages = state.messages.map((m, idx) =>
    idx === lastUserIdx ? { role: "user" as const, content: effect.text } : { ...m }
  );
  return { ...state, messages: nextMessages };
}

function replayDependencyEffects(
  base: PreviewState,
  deps: string[],
  effectsByOpId: ReadonlyMap<string, RuntimeEffect[]>
): PreviewState {
  let state = clonePreview(base);
  for (const depId of deps) {
    const effects = effectsByOpId.get(depId) ?? [];
    for (const effect of effects) {
      state = applyEffectToPreview(state, effect);
    }
  }
  return state;
}

function mapArtifactsByOpId(
  operations: OperationInProfile[],
  artifacts: Record<string, { value: unknown; history: unknown[] }>
): Record<string, { value: unknown; history: unknown[] }> {
  const mapped: Record<string, { value: unknown; history: unknown[] }> = {};
  for (const op of operations) {
    const artifact = readArtifactValue({
      artifacts,
      artifactId: op.config.params.artifact.artifactId,
      tag: op.config.params.artifact.tag,
    });
    if (!artifact) continue;
    mapped[op.opId] = { value: artifact.value, history: [...artifact.history] };
  }
  return mapped;
}

function mapArtifactsForTemplate(
  operations: OperationInProfile[],
  artifacts: Record<string, { value: unknown; history: unknown[] }>
): Record<string, { value: unknown; history: unknown[] }> {
  const mapped: Record<string, { value: unknown; history: unknown[] }> = {};
  for (const op of operations) {
    const artifact = readArtifactValue({
      artifacts,
      artifactId: op.config.params.artifact.artifactId,
      tag: op.config.params.artifact.tag,
    });
    if (!artifact) continue;
    const snapshot = { value: artifact.value, history: [...artifact.history] };
    mapped[op.config.params.artifact.tag] = snapshot;
    mapped[op.config.params.artifact.artifactId] = snapshot;
  }
  return mapped;
}

function mapKnownArtifacts(
  artifacts: Record<string, { value: unknown; history: unknown[] }>
): Record<string, { value: unknown; history: unknown[] }> {
  return Object.fromEntries(
    Object.entries(artifacts).map(([key, value]) => [
      key,
      { value: value.value, history: [...value.history] },
    ])
  );
}

function buildTemplateContext(
  base: InstructionRenderContext,
  state: PreviewState,
  operations: OperationInProfile[]
): InstructionRenderContext {
  const art = {
    ...(base.art ?? {}),
    ...mapKnownArtifacts(state.artifacts),
    ...mapArtifactsForTemplate(operations, state.artifacts),
  };
  return {
    ...base,
    promptSystem: resolvePromptSystem(state.messages),
    art,
    artByOpId: {
      ...(base.artByOpId ?? {}),
      ...mapArtifactsByOpId(operations, state.artifacts),
    },
    messages: state.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

function buildLiquidContextSnapshot(params: {
  base: InstructionRenderContext;
  state: PreviewState;
  operations: OperationInProfile[];
  }): {
  char: unknown;
  user: unknown;
  chat: unknown;
  rag: unknown;
  now: string;
  promptSystem: string;
  messages: Array<{ role: PromptDraftMessage["role"]; content: string }>;
  art: Record<string, { value: unknown; history: unknown[] }>;
  artByOpId?: Record<string, { value: unknown; history: unknown[] }>;
} {
  return {
    char: params.base.char ?? {},
    user: params.base.user ?? {},
    chat: params.base.chat ?? {},
    rag: params.base.rag ?? {},
    now: params.base.now,
    promptSystem: resolvePromptSystem(params.state.messages),
    messages: params.state.messages.map((m) => ({ role: m.role, content: m.content })),
    art: {
      ...mapKnownArtifacts(params.state.artifacts),
      ...mapArtifactsForTemplate(params.operations, params.state.artifacts),
    },
    artByOpId: params.base.artByOpId as Record<string, { value: unknown; history: unknown[] }> | undefined,
  };
}
function normalizeBlockedByOpIds(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return [];
  return Array.from(new Set(input)).sort((a, b) => a.localeCompare(b));
}

function resolveSkipReasonAndDetails(params: {
  reason: OperationSkipReason;
  dependsOn: string[];
  blockedByOpIds?: string[];
  activationSkippedByOpId: ReadonlyMap<string, NonNullable<OperationSkipDetails["activation"]>>;
}): { skipReason: OperationSkipReason; skipDetails?: OperationSkipDetails } {
  if (params.reason === "guard_not_matched") {
    return {
      skipReason: "guard_not_matched",
    };
  }
  const blockedByOpIds = normalizeBlockedByOpIds(
    params.blockedByOpIds?.length
      ? params.blockedByOpIds
      : params.reason === "dependency_missing" || params.reason === "dependency_not_done"
        ? params.dependsOn
        : []
  );
  const activationBlockedBy = blockedByOpIds.filter((opId) =>
    params.activationSkippedByOpId.has(opId)
  );
  const allBlockedByActivation =
    blockedByOpIds.length > 0 && activationBlockedBy.length === blockedByOpIds.length;

  if (params.reason === "dependency_missing" && allBlockedByActivation) {
    return {
      skipReason: "dependency_not_done",
      skipDetails: {
        blockedByOpIds,
        blockedByReason: "activation_not_reached",
      },
    };
  }

  if (params.reason === "dependency_missing" || params.reason === "dependency_not_done") {
    return {
      skipReason: params.reason,
      skipDetails:
        blockedByOpIds.length > 0
          ? {
              blockedByOpIds,
              blockedByReason: allBlockedByActivation ? "activation_not_reached" : undefined,
            }
          : undefined,
    };
  }

  return { skipReason: params.reason };
}

function mapTaskResult(params: {
  hook: OperationHook;
  task: TaskResult;
  op: OperationInProfile;
  activationSkippedByOpId: ReadonlyMap<string, NonNullable<OperationSkipDetails["activation"]>>;
  runtimeSkippedMetaByOpId: ReadonlyMap<
    string,
    { skipReason: OperationSkipReason; skipDetails?: OperationSkipDetails }
  >;
}): OperationExecutionResult {
  const { task, op } = params;
  if (task.status === "done") {
    const rawResult = (task as { result?: unknown }).result;
    const result =
      rawResult && typeof rawResult === "object"
        ? (rawResult as { effects?: unknown; debugSummary?: unknown })
        : {};
    const effects = Array.isArray(result.effects)
      ? (result.effects as RuntimeEffect[])
      : [];
    const debugSummary =
      typeof result.debugSummary === "string" ? result.debugSummary : undefined;

    return {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "done",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects,
      debugSummary,
    };
  }

  if (task.status === "error") {
    return {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "error",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects: [],
      error: toSafeOperationError({
        code: task.error.code,
        message: task.error.message,
        fallbackCode: "OPERATION_ERROR",
      }),
    };
  }

  if (task.status === "aborted") {
    return {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "aborted",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects: [],
      error: toSafeOperationError({
        message: task.reason ?? "Operation aborted",
        fallbackCode: "OPERATION_ABORTED",
      }),
    };
  }

  const runtimeSkipped = params.runtimeSkippedMetaByOpId.get(op.opId);
  if (runtimeSkipped) {
    return {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "skipped",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects: [],
      skipReason: runtimeSkipped.skipReason,
      skipDetails: runtimeSkipped.skipDetails,
    };
  }

  const normalized = resolveSkipReasonAndDetails({
    reason: task.reason as OperationSkipReason,
    dependsOn: op.config.dependsOn ?? [],
    blockedByOpIds: task.blockedByTaskIds,
    activationSkippedByOpId: params.activationSkippedByOpId,
  });
  return {
    opId: op.opId,
    name: op.name,
    required: op.config.required,
    hook: params.hook,
    status: "skipped",
    order: op.config.order,
    dependsOn: op.config.dependsOn ?? [],
    effects: [],
    skipReason: normalized.skipReason,
    skipDetails: normalized.skipDetails,
  };
}

export async function executeOperationsPhase(params: {
  runId: string;
  hook: OperationHook;
  trigger: OperationTrigger;
  operations: OperationInProfile[];
  activationSkippedByOpId?: ReadonlyMap<
    string,
    NonNullable<OperationSkipDetails["activation"]>
  >;
  executionMode: "concurrent" | "sequential";
  baseMessages: PromptDraftMessage[];
  baseArtifacts: Record<string, { value: unknown; history: unknown[] }>;
  assistantText: string;
  templateContext: InstructionRenderContext;
  knowledgeContext?: {
    ownerId: string;
    chatId: string;
    branchId: string | null;
  };
  abortSignal?: AbortSignal;
  onOperationStarted?: (data: { hook: OperationHook; opId: string; name: string }) => void;
  onOperationFinished?: (data: OperationFinishedEventData) => void;
  onTemplateDebug?: (data: {
    hook: OperationHook;
    opId: string;
    name: string;
    template: string;
    rendered: string;
    effect: RuntimeEffect;
    liquidContext: {
      char: unknown;
      user: unknown;
      chat: unknown;
      rag: unknown;
      now: string;
      promptSystem: string;
      messages: Array<{ role: PromptDraftMessage["role"]; content: string }>;
      art: Record<string, { value: unknown; history: unknown[] }>;
      artByOpId?: Record<string, { value: unknown; history: unknown[] }>;
    };
  }) => void;
}): Promise<OperationExecutionResult[]> {
  const candidateOperations = params.operations.filter((op) => {
    if (!op.config.enabled) return false;
    if (!op.config.hooks.includes(params.hook)) return false;
    const triggers = op.config.triggers ?? ["generate", "regenerate"];
    return triggers.includes(params.trigger);
  });

  if (candidateOperations.length === 0) return [];
  const activationSkippedByOpId = params.activationSkippedByOpId ?? new Map();
  const activationSkippedResults: OperationExecutionResult[] = [];
  const runnableOperations: OperationInProfile[] = [];
  for (const op of candidateOperations) {
    const activation = activationSkippedByOpId.get(op.opId);
    if (!activation) {
      runnableOperations.push(op);
      continue;
    }
    const result: OperationExecutionResult = {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "skipped",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects: [],
      skipReason: "activation_not_reached",
      skipDetails: {
        activation: {
          everyNTurns: activation.everyNTurns,
          everyNContextTokens: activation.everyNContextTokens,
          turnsCounter: activation.turnsCounter,
          tokensCounter: activation.tokensCounter,
        },
      },
    };
    activationSkippedResults.push(result);
    params.onOperationFinished?.({
      hook: params.hook,
      opId: op.opId,
      name: op.name,
      status: "skipped",
      skipReason: "activation_not_reached",
      skipDetails: result.skipDetails,
    });
  }

  const executableOps = runnableOperations.filter(
    (
      op
    ): op is Extract<
      OperationInProfile,
      { kind: "template" | "llm" | "guard" | "knowledge_search" | "knowledge_reveal" }
    > =>
      op.kind === "template" ||
      op.kind === "llm" ||
      op.kind === "guard" ||
      op.kind === "knowledge_search" ||
      op.kind === "knowledge_reveal"
  );
  const executableOpsById = new Map(executableOps.map((op) => [op.opId, op]));
  const operationsById = new Map(params.operations.map((op) => [op.opId, op] as const));
  const executableTaskIdSet = new Set(executableOps.map((op) => op.opId));
  const unsupportedOps = runnableOperations.filter(
    (
      op
    ): op is Exclude<
      OperationInProfile,
      Extract<
        OperationInProfile,
        { kind: "template" | "llm" | "guard" | "knowledge_search" | "knowledge_reveal" }
      >
    > =>
      op.kind !== "template" &&
      op.kind !== "llm" &&
      op.kind !== "guard" &&
      op.kind !== "knowledge_search" &&
      op.kind !== "knowledge_reveal"
  );

  const effectsByOpId = new Map<string, RuntimeEffect[]>();
  const taskResultByOpId = new Map<string, NonNullable<OperationFinishedEventData["result"]>>();
  const baseState: PreviewState = {
    messages: params.baseMessages.map((m) => ({ ...m })),
    artifacts: Object.fromEntries(
      Object.entries(params.baseArtifacts).map(([tag, v]) => [tag, { value: v.value, history: [...v.history] }])
    ),
    assistantText: params.assistantText,
  };

  const skippedEventMetaByTaskId = new Map<
    string,
    { skipReason: OperationSkipReason; skipDetails?: OperationSkipDetails }
  >();
  const runtimeSkippedMetaByTaskId = new Map<
    string,
    { skipReason: OperationSkipReason; skipDetails?: OperationSkipDetails }
  >();
  const executableResults: OperationExecutionResult[] = [];
  if (executableOps.length > 0) {
    const orchestration = await runOrchestrator(
      {
        runId: `${params.runId}:${params.hook}`,
        hook: params.hook,
        trigger: params.trigger,
        executionMode: params.executionMode,
        concurrency: OPERATION_RESOURCE_LIMITS.concurrentTasks,
        signal: params.abortSignal,
        tasks: executableOps.map((op) => ({
          taskId: op.opId,
          name: op.name,
          enabled: op.config.enabled,
          required: op.config.required,
          order: op.config.order,
          dependsOn: op.config.dependsOn,
          run: async () => {
            const depPreview = replayDependencyEffects(baseState, op.config.dependsOn ?? [], effectsByOpId);
            const guardConditionResult = evaluateGuardRunConditions({
              op,
              operationsById,
              artifacts: depPreview.artifacts,
            });
            if (!guardConditionResult.matched) {
              runtimeSkippedMetaByTaskId.set(op.opId, {
                skipReason: "guard_not_matched",
                skipDetails: {
                  guard: guardConditionResult.details,
                },
              });
              throw createTaskSkip("runtime_condition", "guard_not_matched");
            }
            const liquidContext = buildTemplateContext(params.templateContext, depPreview, params.operations);
            let resolvedRendered: unknown = "";
            let debugSummary: string | undefined;

            if (op.kind === "template") {
              resolvedRendered = normalizeText(
                await renderLiquidTemplate({
                  templateText: op.config.params.template,
                  context: liquidContext,
                  options: { strictVariables: Boolean(op.config.params.strictVariables) },
                })
              );
            }

            if (op.kind === "llm") {
              const llmResult = await executeLlmOperation({
                op,
                liquidContext,
                abortSignal: params.abortSignal,
              });
              resolvedRendered = normalizeText(llmResult.rendered);
              debugSummary = llmResult.debugSummary;
            }

            if (op.kind === "guard") {
              const guardResult = await executeGuardOperation({
                op,
                liquidContext,
                abortSignal: params.abortSignal,
              });
              resolvedRendered = guardResult.value;
              debugSummary = guardResult.debugSummary;
            }

            if (op.kind === "knowledge_search" || op.kind === "knowledge_reveal") {
              if (!params.knowledgeContext) {
                throw new Error("knowledgeContext is required for knowledge operations");
              }
              const knowledgeResult = await executeKnowledgeOperation({
                op,
                liquidContext,
                artifacts: depPreview.artifacts,
                knowledgeContext: params.knowledgeContext,
              });
              effectsByOpId.set(op.opId, knowledgeResult.effects);
              taskResultByOpId.set(op.opId, {
                effects: knowledgeResult.effects,
                debugSummary: knowledgeResult.debugSummary,
              });
              return knowledgeResult;
            }

            assertArtifactValueWithinLimits(resolvedRendered);
            const artifact = op.config.params.artifact;
            const effects: RuntimeEffect[] = [
              {
                type: "artifact.upsert",
                opId: op.opId,
                artifactId: getRuntimeArtifactKey(artifact),
                format: artifact.format,
                persistence: artifact.persistence,
                writeMode: artifact.writeMode,
                history: artifact.history,
                semantics: artifact.semantics ?? "intermediate",
                value: resolvedRendered,
              },
              ...artifact.exposures.map((exposure) =>
                compileArtifactExposureEffect({
                  opId: op.opId,
                  artifact,
                  exposure,
                  value: resolvedRendered,
                })
              ),
            ];
            const effect = effects[0];
            if (op.kind === "template") {
              params.onTemplateDebug?.({
                hook: params.hook,
                opId: op.opId,
                name: op.name,
                template: op.config.params.template,
                rendered:
                  typeof resolvedRendered === "string"
                    ? resolvedRendered
                    : JSON.stringify(resolvedRendered),
                effect,
                liquidContext: buildLiquidContextSnapshot({
                  base: liquidContext,
                  state: depPreview,
                  operations: params.operations,
                }),
              });
            }
            effectsByOpId.set(op.opId, effects);
            taskResultByOpId.set(op.opId, {
              effects,
              debugSummary:
                debugSummary ??
                `${getArtifactPrimaryEffectType(op.config.params.artifact)}:${normalizeText(
                  typeof resolvedRendered === "string"
                    ? resolvedRendered
                    : JSON.stringify(resolvedRendered)
                ).length}`,
            });
            return {
              effects,
              debugSummary:
                debugSummary ??
                `${getArtifactPrimaryEffectType(op.config.params.artifact)}:${normalizeText(resolvedRendered).length}`,
            };
          },
        })),
      },
      {
        onEvent: (evt) => {
          if (evt.type === "orch.task.started") {
            const op = executableOpsById.get(evt.data.taskId);
            if (!op) return;
            params.onOperationStarted?.({ hook: params.hook, opId: op.opId, name: op.name });
            return;
          }
          if (evt.type === "orch.task.skipped") {
            const op = executableOpsById.get(evt.data.taskId);
            if (!op) return;
            if (evt.data.reason === "runtime_condition") {
              const runtimeMeta = runtimeSkippedMetaByTaskId.get(op.opId);
              if (runtimeMeta) {
                skippedEventMetaByTaskId.set(op.opId, runtimeMeta);
              }
              return;
            }
            const missingDeps =
              evt.data.reason === "dependency_missing"
                ? (op.config.dependsOn ?? []).filter((depId) => !executableTaskIdSet.has(depId))
                : op.config.dependsOn ?? [];
            skippedEventMetaByTaskId.set(
              op.opId,
              resolveSkipReasonAndDetails({
                reason: evt.data.reason as OperationSkipReason,
                dependsOn: op.config.dependsOn ?? [],
                blockedByOpIds: missingDeps,
                activationSkippedByOpId,
              })
            );
            return;
          }
          if (evt.type === "orch.task.finished") {
            const op = executableOpsById.get(evt.data.taskId);
            if (!op) return;
            if (evt.data.status === "skipped") {
              const normalized =
                skippedEventMetaByTaskId.get(op.opId) ??
                resolveSkipReasonAndDetails({
                  reason: "dependency_not_done",
                  dependsOn: op.config.dependsOn ?? [],
                  activationSkippedByOpId,
                });
              params.onOperationFinished?.({
                hook: params.hook,
                opId: op.opId,
                name: op.name,
                status: "skipped",
                skipReason: normalized.skipReason,
                skipDetails: normalized.skipDetails,
              });
              return;
            }
            const result =
              evt.data.status === "done" ? taskResultByOpId.get(op.opId) : undefined;
            const error =
              evt.data.status === "error"
                ? toSafeOperationError({
                    code: evt.data.error.code,
                    message: evt.data.error.message,
                    fallbackCode: "OPERATION_ERROR",
                  })
                : evt.data.status === "aborted"
                  ? toSafeOperationError({
                      message: evt.data.reason ?? "Operation aborted",
                      fallbackCode: "OPERATION_ABORTED",
                    })
                  : undefined;
            params.onOperationFinished?.({
              hook: params.hook,
              opId: op.opId,
              name: op.name,
              status: evt.data.status,
              error,
              result,
            });
          }
        },
      }
    );

    executableResults.push(
      ...orchestration.tasks
        .map((task) => {
          const op = executableOpsById.get(task.taskId);
          if (!op) return null;
          return mapTaskResult({
            hook: params.hook,
            op,
            task,
            activationSkippedByOpId,
            runtimeSkippedMetaByOpId: runtimeSkippedMetaByTaskId,
          });
        })
        .filter((item): item is OperationExecutionResult => Boolean(item))
    );
  }

  const nonTemplateResults: OperationExecutionResult[] = unsupportedOps.map((op) => ({
    opId: op.opId,
    name: op.name,
    required: op.config.required,
    hook: params.hook,
    status: "skipped",
    order: op.config.order,
    dependsOn: op.config.dependsOn ?? [],
    effects: [],
    skipReason: "unsupported_kind",
  }));

  const all = [...activationSkippedResults, ...executableResults, ...nonTemplateResults].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.opId.localeCompare(b.opId);
  });

  for (const item of nonTemplateResults) {
    params.onOperationFinished?.({
      hook: params.hook,
      opId: item.opId,
      name: item.name,
      status: "skipped",
      skipReason: "unsupported_kind",
    });
  }

  return all;
}


