import { runOrchestrator } from "@core/operation-orchestrator";
import type {
  OperationInProfile,
  OperationOutput,
  OperationProfile,
  OperationTrigger,
} from "@shared/types/operation-profiles";

import type { PromptTemplateRenderContext } from "../chat-core/prompt-template-renderer";
import { renderLiquidTemplate } from "../chat-core/prompt-template-renderer";

export type PromptDraftMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RuntimeState = {
  messages: PromptDraftMessage[];
  art: Record<string, { value: string; history: string[] }>;
  assistantText: string;
};

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

function normalizePromptTimeRole(value: unknown): PromptDraftMessage["role"] {
  if (value === "assistant" || value === "user" || value === "system") return value;
  if (value === "developer") return "system";
  return "system";
}

function resolveMinInsertIndex(messages: PromptDraftMessage[]): number {
  const firstSystemIdx = messages.findIndex((message) => message.role === "system");
  return firstSystemIdx >= 0 ? firstSystemIdx + 1 : 0;
}

function applyPromptTimeEffect(
  state: RuntimeState,
  output: Extract<OperationOutput, { type: "prompt_time" }>,
  payload: string
): void {
  const promptTime = output.promptTime;
  if (promptTime.kind === "system_update") {
    const idx = state.messages.findIndex((m) => m.role === "system");
    const current = idx >= 0 ? state.messages[idx]!.content : "";

    const next =
      promptTime.mode === "replace"
        ? payload
        : promptTime.mode === "prepend"
          ? `${payload}${current}`
          : `${current}${payload}`;

    if (idx >= 0) state.messages[idx] = { role: "system", content: next };
    else state.messages.unshift({ role: "system", content: next });
    return;
  }

  if (promptTime.kind === "append_after_last_user") {
    const lastUserIdx = state.messages.map((m) => m.role).lastIndexOf("user");
    const insertAt = lastUserIdx >= 0 ? lastUserIdx + 1 : state.messages.length;
    state.messages.splice(insertAt, 0, { role: normalizePromptTimeRole(promptTime.role), content: payload });
    return;
  }

  const raw = state.messages.length - Math.abs(promptTime.depthFromEnd);
  const minInsertAt = resolveMinInsertIndex(state.messages);
  const insertAt = Math.min(state.messages.length, Math.max(minInsertAt, raw));
  state.messages.splice(insertAt, 0, { role: normalizePromptTimeRole(promptTime.role), content: payload });
}

function applyTurnCanonicalizationEffect(
  state: RuntimeState,
  output: Extract<OperationOutput, { type: "turn_canonicalization" }>,
  payload: string,
  hook: "before_main_llm" | "after_main_llm"
): void {
  const canonicalization = output.canonicalization;
  if (canonicalization.kind !== "replace_text") return;

  if (canonicalization.target === "assistant" && hook === "after_main_llm") {
    state.assistantText = payload;
    return;
  }

  if (canonicalization.target === "user") {
    const lastUserIdx = state.messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx >= 0) {
      state.messages[lastUserIdx] = { role: "user", content: payload };
    }
  }
}

function applyOperationOutput(
  state: RuntimeState,
  output: OperationOutput,
  payload: string,
  hook: "before_main_llm" | "after_main_llm"
): void {
  if (output.type === "prompt_time") {
    if (hook === "before_main_llm") applyPromptTimeEffect(state, output, payload);
    return;
  }

  if (output.type === "turn_canonicalization") {
    applyTurnCanonicalizationEffect(state, output, payload, hook);
    return;
  }

  const tag = output.writeArtifact.tag;
  const existing = state.art[tag];
  if (existing) {
    existing.value = payload;
    existing.history.push(payload);
    return;
  }
  state.art[tag] = { value: payload, history: [payload] };
}

function buildOperationContext(
  base: PromptTemplateRenderContext,
  state: RuntimeState
): PromptTemplateRenderContext {
  return {
    ...base,
    promptSystem: resolvePromptSystem(state.messages),
    art: { ...(base.art ?? {}), ...state.art },
    messages: state.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

async function runTemplateOperations(params: {
  runId: string;
  profile: OperationProfile;
  trigger: OperationTrigger;
  hook: "before_main_llm" | "after_main_llm";
  state: RuntimeState;
  templateContext: PromptTemplateRenderContext;
}): Promise<void> {
  const ops = params.profile.operations.filter(
    (op): op is Extract<OperationInProfile, { kind: "template" }> =>
      op.kind === "template" &&
      op.config.hooks.includes(params.hook) &&
      (op.config.triggers ?? ["generate", "regenerate"]).includes(params.trigger)
  );

  if (ops.length === 0) return;

  const result = await runOrchestrator({
    runId: params.runId,
    hook: params.hook,
    trigger: params.trigger,
    executionMode: params.profile.executionMode,
    tasks: ops.map((op) => ({
      taskId: op.opId,
      name: op.name,
      enabled: op.config.enabled,
      required: op.config.required,
      order: op.config.order,
      dependsOn: op.config.dependsOn,
      run: async () => {
        const rendered = normalizeText(
          await renderLiquidTemplate({
            templateText: op.config.params.template,
            context: buildOperationContext(params.templateContext, params.state),
            options: { strictVariables: Boolean(op.config.params.strictVariables) },
          })
        );

        applyOperationOutput(params.state, op.config.params.output, rendered, params.hook);
        return { output: rendered };
      },
    })),
  });

  const byOpId = new Map(ops.map((op) => [op.opId, op] as const));
  const failedRequired = result.tasks.filter((task) => {
    const op = byOpId.get(task.taskId);
    return Boolean(op?.config.required) && task.status !== "done";
  });

  if (failedRequired.length > 0) {
    const first = failedRequired[0]!;
    throw new Error(`Required template operation failed: ${first.taskId} (${first.status})`);
  }
}

export async function applyTemplateOperationsToPromptDraft(params: {
  runId: string;
  profile: OperationProfile;
  trigger: OperationTrigger;
  draftMessages: PromptDraftMessage[];
  templateContext: PromptTemplateRenderContext;
}): Promise<{
  messages: PromptDraftMessage[];
  artifacts: Record<string, { value: string; history: string[] }>;
}> {
  const state: RuntimeState = {
    messages: params.draftMessages.map((m) => ({ ...m })),
    art: {},
    assistantText: "",
  };

  await runTemplateOperations({
    runId: `${params.runId}:before`,
    profile: params.profile,
    trigger: params.trigger,
    hook: "before_main_llm",
    state,
    templateContext: params.templateContext,
  });

  return { messages: state.messages, artifacts: state.art };
}

export async function applyTemplateOperationsAfterMainLlm(params: {
  runId: string;
  profile: OperationProfile;
  trigger: OperationTrigger;
  draftMessages: PromptDraftMessage[];
  assistantText: string;
  templateContext: PromptTemplateRenderContext;
}): Promise<{
  assistantText: string;
  artifacts: Record<string, { value: string; history: string[] }>;
}> {
  const state: RuntimeState = {
    messages: params.draftMessages.map((m) => ({ ...m })),
    art: {},
    assistantText: params.assistantText,
  };

  // Make the generated assistant message available for after_main_llm templates.
  state.messages.push({ role: "assistant", content: state.assistantText });

  await runTemplateOperations({
    runId: `${params.runId}:after`,
    profile: params.profile,
    trigger: params.trigger,
    hook: "after_main_llm",
    state,
    templateContext: params.templateContext,
  });

  return {
    assistantText: state.assistantText,
    artifacts: state.art,
  };
}
