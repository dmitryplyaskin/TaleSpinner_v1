import { getProviderConfig, getRuntime } from "../llm/llm-repository";
import { streamGlobalChat } from "../llm/llm-service";
import { resolveGatewayModel } from "../llm/llm-gateway-adapter";

import {
  getChatById,
  listMessagesForPrompt,
  updateAssistantText,
} from "./chats-repository";
import { updatePartPayloadText } from "../chat-entry-parts/parts-repository";
import { getEntityProfileById } from "./entity-profiles-repository";
import { registerGeneration, unregisterGeneration } from "./generation-runtime";
import { finishGeneration } from "./generations-repository";
import { renderLiquidTemplate } from "./prompt-template-renderer";
import { pickPromptTemplateForChat } from "./prompt-templates-repository";
import { getSelectedUserPerson } from "./user-persons-repository";
import { getOperationProfileSettings } from "../operations/operation-profile-settings-repository";
import { getOperationProfileById } from "../operations/operation-profiles-repository";
import { buildPromptTemplateRenderContext } from "./prompt-template-context";
import { applyTemplateOperationsAfterMainLlm } from "../operations/template-operations-runtime";

import type { GenerateMessage } from "@shared/types/generate";
import type { OperationTrigger } from "@shared/types/operation-profiles";

export type OrchestratorEvent =
  | { type: "llm.stream.delta"; data: { content: string } }
  | { type: "llm.stream.error"; data: { message: string } }
  | { type: "llm.stream.done"; data: { status: "done" | "aborted" | "error" } };

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_FLUSH_MS = 750;

export async function* runChatGeneration(params: {
  ownerId?: string;
  generationId: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  systemPrompt?: string;
  /**
   * If provided, orchestrator will use these messages as-is (v1: built by pipeline pre-step).
   * Must not include `developer` role (map it to `system` before calling).
   */
  promptMessages?: GenerateMessage[];
  promptDraftMessages?: Array<{ role: "system" | "developer" | "user" | "assistant"; content: string }>;
  trigger?: OperationTrigger;
  /**
   * Optional correlation id for the current user message.
   * Regenerate flow does not have a user message; do not pass empty strings.
   */
  userMessageId?: string;
  assistantMessageId: string;
  variantId: string;
  /**
   * Persistence mode:
   * - "legacy": writes to chat_messages/message_variants promptText cache
   * - "entry_parts": writes to variant_parts (assistant main part payload)
   */
  persistMode?: "legacy" | "entry_parts";
  assistantMainPartId?: string;
  settings: Record<string, unknown>;
  flushMs?: number;
  /**
   * Optional externally-managed AbortController (v1: one controller per PipelineRun).
   * If omitted, the orchestrator creates and owns its own controller.
   */
  abortController?: AbortController;
}): AsyncGenerator<OrchestratorEvent> {
  const abortController = params.abortController ?? new AbortController();
  registerGeneration(params.generationId, abortController);

  let assistantText = "";
  let finishedStatus: "done" | "aborted" | "error" = "done";
  let errorMessage: string | null = null;

  let flushing = Promise.resolve();
  let closed = false;

  const flush = async (): Promise<void> => {
    // Serialize flush calls to avoid overlapping writes.
    flushing = flushing.then(async () => {
      if (closed) return;
      if (params.persistMode === "entry_parts" && typeof params.assistantMainPartId === "string") {
        await updatePartPayloadText({
          partId: params.assistantMainPartId,
          payloadText: assistantText,
          payloadFormat: "markdown",
        });
        return;
      }
      await updateAssistantText({
        assistantMessageId: params.assistantMessageId,
        variantId: params.variantId,
        text: assistantText,
      });
    });
    await flushing;
  };

  const timer = setInterval(() => {
    void flush();
  }, params.flushMs ?? DEFAULT_FLUSH_MS);

  try {
    if (abortController.signal.aborted) {
      finishedStatus = "aborted";
      return;
    }

    let prompt: GenerateMessage[] | null = null;
    if (Array.isArray(params.promptMessages) && params.promptMessages.length > 0) {
      prompt = params.promptMessages;
    }

    if (!prompt) {
      const history = await listMessagesForPrompt({
        chatId: params.chatId,
        branchId: params.branchId,
        limit: DEFAULT_HISTORY_LIMIT,
        excludeMessageIds: [params.assistantMessageId],
      });

      let systemPrompt =
        typeof params.systemPrompt === "string"
          ? params.systemPrompt
          : DEFAULT_SYSTEM_PROMPT;
      if (typeof params.systemPrompt !== "string") {
        try {
          const [chat, entityProfile, template, userPerson] = await Promise.all([
            getChatById(params.chatId),
            getEntityProfileById(params.entityProfileId),
            pickPromptTemplateForChat({
              ownerId: params.ownerId ?? "global",
              chatId: params.chatId,
            }),
            getSelectedUserPerson({ ownerId: params.ownerId ?? "global" }),
          ]);

          if (template && entityProfile) {
            const rendered = await renderLiquidTemplate({
              templateText: template.templateText,
              context: {
                char: entityProfile.spec,
                user: userPerson ?? {},
                chat: {
                  id: chat?.id ?? params.chatId,
                  title: chat?.title ?? "",
                  branchId: params.branchId,
                  createdAt: chat?.createdAt ?? null,
                  updatedAt: chat?.updatedAt ?? null,
                },
                messages: history.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
                rag: {},
                now: new Date().toISOString(),
              },
            });
            const normalized = rendered.trim();
            if (normalized) systemPrompt = normalized;
          }
        } catch {
          // Fallback to DEFAULT_SYSTEM_PROMPT on any template/render failure.
        }
      }

      prompt = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];
    }

    const messageStream = streamGlobalChat({
      messages: prompt,
      settings: params.settings ?? {},
      scopeId: params.ownerId ?? "global",
      abortController,
    });

    for await (const chunk of messageStream) {
      if (abortController.signal.aborted) {
        finishedStatus = "aborted";
        break;
      }

      if (chunk.error) {
        finishedStatus = "error";
        errorMessage = chunk.error;
        yield { type: "llm.stream.error", data: { message: chunk.error } };
        break;
      }

      if (chunk.content) {
        assistantText += chunk.content;
        yield { type: "llm.stream.delta", data: { content: chunk.content } };
      }
    }

    if (finishedStatus === "done") {
      const trigger = params.trigger ?? "generate";
      const settings = await getOperationProfileSettings();
      if (settings.activeProfileId) {
        const profile = await getOperationProfileById(settings.activeProfileId);
        if (profile && profile.enabled) {
          const templateContext = await buildPromptTemplateRenderContext({
            ownerId: params.ownerId,
            chatId: params.chatId,
            branchId: params.branchId,
            historyLimit: DEFAULT_HISTORY_LIMIT,
            excludeMessageIds: [params.assistantMessageId],
          });

          const afterResult = await applyTemplateOperationsAfterMainLlm({
            runId: `op-prof-${params.chatId}-${params.generationId}`,
            profile,
            trigger,
            draftMessages:
              params.promptDraftMessages ??
              (prompt ?? []).map((m) => ({
                role: (m.role === "system" ? "system" : m.role) as
                  | "system"
                  | "developer"
                  | "user"
                  | "assistant",
                content: m.content,
              })),
            assistantText,
            templateContext,
          });

          assistantText = afterResult.assistantText;
        }
      }
    }
  } catch (error) {
    finishedStatus = "error";
    const message = error instanceof Error ? error.message : String(error);
    errorMessage = message;
    yield { type: "llm.stream.error", data: { message } };
  } finally {
    closed = true;
    clearInterval(timer);
    try {
      // Final flush: ensure DB has the latest.
      if (params.persistMode === "entry_parts" && typeof params.assistantMainPartId === "string") {
        await updatePartPayloadText({
          partId: params.assistantMainPartId,
          payloadText: assistantText,
          payloadFormat: "markdown",
        });
      } else {
        await updateAssistantText({
          assistantMessageId: params.assistantMessageId,
          variantId: params.variantId,
          text: assistantText,
        });
      }

      await finishGeneration({
        id: params.generationId,
        status:
          finishedStatus === "done"
            ? "done"
            : finishedStatus === "aborted"
            ? "aborted"
            : "error",
        error: errorMessage,
      });
    } finally {
      unregisterGeneration(params.generationId);
    }

    yield { type: "llm.stream.done", data: { status: finishedStatus } };
  }
}

export async function getGlobalRuntimeInfo(): Promise<{
  providerId: string;
  model: string;
}> {
  const runtime = await getRuntime("global", "global");
  const config = await getProviderConfig(runtime.activeProviderId);
  return {
    providerId: runtime.activeProviderId,
    model: resolveGatewayModel({
      providerId: runtime.activeProviderId,
      runtimeModel: runtime.activeModel,
      providerConfig: config.config,
    }),
  };
}

export async function getRuntimeInfo(params?: { ownerId?: string }): Promise<{
  providerId: string;
  model: string;
}> {
  const ownerId = params?.ownerId ?? "global";
  const runtime = await getRuntime("global", ownerId);
  const config = await getProviderConfig(runtime.activeProviderId);
  return {
    providerId: runtime.activeProviderId,
    model: resolveGatewayModel({
      providerId: runtime.activeProviderId,
      runtimeModel: runtime.activeModel,
      providerConfig: config.config,
    }),
  };
}
