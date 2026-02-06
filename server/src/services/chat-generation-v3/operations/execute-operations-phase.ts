import { runOrchestrator } from "@core/operation-orchestrator";
import type { OperationHook, OperationInProfile, OperationTrigger } from "@shared/types/operation-profiles";

import { renderLiquidTemplate } from "../../chat-core/prompt-template-renderer";
import type { PromptTemplateRenderContext } from "../../chat-core/prompt-template-renderer";
import type { TaskResult } from "../../../core/operation-orchestrator/types";
import {
  mapOperationOutputToEffectType,
  type OperationExecutionResult,
  type PromptDraftMessage,
  type RuntimeEffect,
} from "../contracts";
import { applyPromptEffect } from "./effect-handlers/prompt-effects";

type PreviewState = {
  messages: PromptDraftMessage[];
  artifacts: Record<string, { value: string; history: string[] }>;
  assistantText: string;
};

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

function toRuntimeEffect(params: {
  opId: string;
  output: OperationInProfile["config"]["params"]["output"];
  rendered: string;
}): RuntimeEffect {
  const { opId, output, rendered } = params;
  if (output.type === "artifacts") {
    return {
      type: "artifact.upsert",
      opId,
      tag: output.writeArtifact.tag,
      persistence: output.writeArtifact.persistence,
      usage: output.writeArtifact.usage,
      semantics: output.writeArtifact.semantics,
      value: rendered,
    };
  }

  if (output.type === "turn_canonicalization") {
    return output.canonicalization.target === "assistant"
      ? { type: "turn.assistant.replace_text", opId, text: rendered }
      : { type: "turn.user.replace_text", opId, text: rendered };
  }

  if (output.promptTime.kind === "system_update") {
    return {
      type: "prompt.system_update",
      opId,
      mode: output.promptTime.mode,
      payload: rendered,
      source: output.promptTime.source,
    };
  }

  if (output.promptTime.kind === "append_after_last_user") {
    return {
      type: "prompt.append_after_last_user",
      opId,
      role: output.promptTime.role,
      payload: rendered,
      source: output.promptTime.source,
    };
  }

  return {
    type: "prompt.insert_at_depth",
    opId,
    role: output.promptTime.role,
    depthFromEnd: output.promptTime.depthFromEnd,
    payload: rendered,
    source: output.promptTime.source,
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
    const existing = state.artifacts[effect.tag];
    const history = [...(existing?.history ?? []), effect.value];
    return {
      ...state,
      artifacts: {
        ...state.artifacts,
        [effect.tag]: {
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

function buildTemplateContext(base: PromptTemplateRenderContext, state: PreviewState): PromptTemplateRenderContext {
  return {
    ...base,
    art: {
      ...(base.art ?? {}),
      ...Object.fromEntries(
        Object.entries(state.artifacts).map(([tag, value]) => [tag, { value: value.value, history: value.history }])
      ),
    },
    messages: state.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

function mapTaskResult(params: {
  hook: OperationHook;
  task: TaskResult;
  op: OperationInProfile;
}): OperationExecutionResult {
  const { task, op } = params;
  if (task.status === "done") {
    const result =
      typeof (task as { result?: unknown }).result === "object" && (task as { result?: unknown }).result !== null
        ? ((task as { result?: any }).result as { effects?: RuntimeEffect[]; debugSummary?: string })
        : { effects: [] };

    return {
      opId: op.opId,
      name: op.name,
      required: op.config.required,
      hook: params.hook,
      status: "done",
      order: op.config.order,
      dependsOn: op.config.dependsOn ?? [],
      effects: Array.isArray(result.effects) ? result.effects : [],
      debugSummary: result.debugSummary,
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
      error: {
        code: task.error.code ?? "OPERATION_ERROR",
        message: task.error.message,
      },
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
      error: task.reason
        ? {
            code: "OPERATION_ABORTED",
            message: task.reason,
          }
        : undefined,
    };
  }

  return {
    opId: op.opId,
    name: op.name,
    required: op.config.required,
    hook: params.hook,
    status: "skipped",
    order: op.config.order,
    dependsOn: op.config.dependsOn ?? [],
    effects: [],
    skipReason: task.reason,
  };
}

export async function executeOperationsPhase(params: {
  runId: string;
  hook: OperationHook;
  trigger: OperationTrigger;
  operations: OperationInProfile[];
  executionMode: "concurrent" | "sequential";
  baseMessages: PromptDraftMessage[];
  baseArtifacts: Record<string, { value: string; history: string[] }>;
  assistantText: string;
  templateContext: PromptTemplateRenderContext;
  abortSignal?: AbortSignal;
  onOperationStarted?: (data: { hook: OperationHook; opId: string; name: string }) => void;
  onOperationFinished?: (data: {
    hook: OperationHook;
    opId: string;
    name: string;
    status: "done" | "skipped" | "error" | "aborted";
    skipReason?: string;
    error?: { code: string; message: string };
  }) => void;
}): Promise<OperationExecutionResult[]> {
  const filtered = params.operations.filter((op) => {
    if (!op.config.enabled) return true;
    if (!op.config.hooks.includes(params.hook)) return false;
    const triggers = op.config.triggers ?? ["generate", "regenerate"];
    return triggers.includes(params.trigger);
  });

  if (filtered.length === 0) return [];

  const templateOps = filtered.filter((op): op is Extract<OperationInProfile, { kind: "template" }> => op.kind === "template");
  const nonTemplate = filtered.filter((op) => op.kind !== "template");

  const effectsByOpId = new Map<string, RuntimeEffect[]>();
  const baseState: PreviewState = {
    messages: params.baseMessages.map((m) => ({ ...m })),
    artifacts: Object.fromEntries(
      Object.entries(params.baseArtifacts).map(([tag, v]) => [tag, { value: v.value, history: [...v.history] }])
    ),
    assistantText: params.assistantText,
  };

  const orchestration = await runOrchestrator(
    {
      runId: `${params.runId}:${params.hook}`,
      hook: params.hook,
      trigger: params.trigger,
      executionMode: params.executionMode,
      signal: params.abortSignal,
      tasks: templateOps.map((op) => ({
        taskId: op.opId,
        name: op.name,
        enabled: op.config.enabled,
        required: op.config.required,
        order: op.config.order,
        dependsOn: op.config.dependsOn,
        run: async () => {
          const depPreview = replayDependencyEffects(baseState, op.config.dependsOn ?? [], effectsByOpId);
          const rendered = normalizeText(
            await renderLiquidTemplate({
              templateText: op.config.params.template,
              context: buildTemplateContext(params.templateContext, depPreview),
              options: { strictVariables: Boolean(op.config.params.strictVariables) },
            })
          );
          const effect = toRuntimeEffect({
            opId: op.opId,
            output: op.config.params.output,
            rendered,
          });
          const effects: RuntimeEffect[] = [effect];
          effectsByOpId.set(op.opId, effects);
          return {
            effects,
            debugSummary: `${mapOperationOutputToEffectType(op.config.params.output)}:${rendered.length}`,
          };
        },
      })),
    },
    {
      onEvent: (evt) => {
        if (evt.type === "orch.task.started") {
          const op = templateOps.find((item) => item.opId === evt.data.taskId);
          if (!op) return;
          params.onOperationStarted?.({ hook: params.hook, opId: op.opId, name: op.name });
          return;
        }
        if (evt.type === "orch.task.finished") {
          const op = templateOps.find((item) => item.opId === evt.data.taskId);
          if (!op) return;
          params.onOperationFinished?.({
            hook: params.hook,
            opId: op.opId,
            name: op.name,
            status: evt.data.status,
          });
          return;
        }
        if (evt.type === "orch.task.skipped") {
          const op = templateOps.find((item) => item.opId === evt.data.taskId);
          if (!op) return;
          params.onOperationFinished?.({
            hook: params.hook,
            opId: op.opId,
            name: op.name,
            status: "skipped",
            skipReason: evt.data.reason,
          });
        }
      },
    }
  );

  const templateResults = orchestration.tasks
    .map((task) => {
      const op = templateOps.find((item) => item.opId === task.taskId);
      if (!op) return null;
      return mapTaskResult({ hook: params.hook, op, task });
    })
    .filter((item): item is OperationExecutionResult => Boolean(item));

  const nonTemplateResults: OperationExecutionResult[] = nonTemplate.map((op) => ({
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

  const all = [...templateResults, ...nonTemplateResults].sort((a, b) => {
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
