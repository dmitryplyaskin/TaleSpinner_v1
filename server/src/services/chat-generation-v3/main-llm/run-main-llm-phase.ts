import { updatePartPayloadText } from "../../chat-entry-parts/parts-repository";
import { streamGlobalChat } from "../../llm/llm-service";
import { stripChatGenerationDebugSettings } from "../debug";

import type { RunRequest, RunState } from "../contracts";

const DEFAULT_FLUSH_MS = 750;

export async function runMainLlmPhase(params: {
  request: RunRequest;
  runState: RunState;
  ownerId: string;
  abortController: AbortController;
  onDelta: (content: string) => void;
  onReasoningDelta: (content: string) => void;
}): Promise<{ status: "done" | "aborted" | "error"; message?: string }> {
  let flushing = Promise.resolve();
  let closed = false;
  let flushedAssistantText = "";
  let flushedReasoningText = "";

  const flush = async (force = false): Promise<void> => {
    flushing = flushing.then(async () => {
      if (closed && !force) return;
      const writes: Array<Promise<void>> = [];

      if (force || flushedAssistantText !== params.runState.assistantText) {
        writes.push(
          updatePartPayloadText({
            partId: params.request.persistenceTarget.assistantMainPartId,
            payloadText: params.runState.assistantText,
            payloadFormat: "markdown",
          })
        );
        flushedAssistantText = params.runState.assistantText;
      }

      const reasoningPartId = params.request.persistenceTarget.assistantReasoningPartId;
      if (
        reasoningPartId &&
        (force || flushedReasoningText !== params.runState.assistantReasoningText)
      ) {
        writes.push(
          updatePartPayloadText({
            partId: reasoningPartId,
            payloadText: params.runState.assistantReasoningText,
            payloadFormat: "markdown",
          })
        );
        flushedReasoningText = params.runState.assistantReasoningText;
      }

      if (writes.length > 0) {
        await Promise.all(writes);
      }
    });
    await flushing;
  };

  const timer = setInterval(() => {
    void flush(false);
  }, params.request.flushMs ?? DEFAULT_FLUSH_MS);

  try {
    const messageStream = streamGlobalChat({
      messages: params.runState.llmMessages,
      settings: stripChatGenerationDebugSettings(params.request.settings),
      scopeId: params.ownerId,
      abortController: params.abortController,
    });

    for await (const chunk of messageStream) {
      if (params.abortController.signal.aborted) {
        return { status: "aborted", message: "aborted" };
      }

      if (chunk.error) {
        return { status: "error", message: chunk.error };
      }

      if (chunk.content) {
        params.runState.assistantText += chunk.content;
        params.onDelta(chunk.content);
      }

      if (chunk.reasoning) {
        params.runState.assistantReasoningText += chunk.reasoning;
        params.onReasoningDelta(chunk.reasoning);
      }
    }

    return { status: "done" };
  } finally {
    closed = true;
    clearInterval(timer);
    await flush(true);
  }
}
