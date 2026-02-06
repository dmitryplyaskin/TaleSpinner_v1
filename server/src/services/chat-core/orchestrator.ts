import { getProviderConfig, getRuntime } from "../llm/llm-repository";
import { resolveGatewayModel } from "../llm/llm-gateway-adapter";
import { runChatGenerationV3 } from "../chat-generation-v3/run-chat-generation-v3";

import type { OperationTrigger } from "@shared/types/operation-profiles";

export type OrchestratorEvent =
  | { type: "llm.stream.delta"; data: { content: string } }
  | { type: "llm.stream.error"; data: { message: string } }
  | { type: "llm.stream.done"; data: { status: "done" | "aborted" | "error" } };

export async function* runChatGeneration(params: {
  ownerId?: string;
  generationId: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  trigger?: OperationTrigger;
  userMessageId?: string;
  assistantMessageId: string;
  variantId: string;
  persistMode?: "legacy" | "entry_parts";
  assistantMainPartId?: string;
  settings: Record<string, unknown>;
  flushMs?: number;
  abortController?: AbortController;
}): AsyncGenerator<OrchestratorEvent> {
  const persistenceTarget =
    params.persistMode === "entry_parts" && params.assistantMainPartId
      ? {
          mode: "entry_parts" as const,
          assistantMessageId: params.assistantMessageId,
          variantId: params.variantId,
          assistantEntryId: params.assistantMessageId,
          assistantMainPartId: params.assistantMainPartId,
        }
      : {
          mode: "legacy" as const,
          assistantMessageId: params.assistantMessageId,
          variantId: params.variantId,
        };

  const userTurnTarget = params.userMessageId
    ? ({
        mode: "legacy",
        userMessageId: params.userMessageId,
      } as const)
    : undefined;

  for await (const evt of runChatGenerationV3({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    trigger: params.trigger ?? "generate",
    settings: params.settings,
    flushMs: params.flushMs,
    abortController: params.abortController,
    persistenceTarget,
    userTurnTarget,
  })) {
    if (evt.type === "main_llm.delta") {
      yield { type: "llm.stream.delta", data: { content: evt.data.content } };
      continue;
    }
    if (evt.type === "main_llm.finished" && evt.data.status === "error") {
      yield {
        type: "llm.stream.error",
        data: { message: evt.data.message ?? "main_llm_error" },
      };
      continue;
    }
    if (evt.type === "run.finished") {
      yield {
        type: "llm.stream.done",
        data: {
          status:
            evt.data.status === "done"
              ? "done"
              : evt.data.status === "aborted"
                ? "aborted"
                : "error",
        },
      };
      return;
    }
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
