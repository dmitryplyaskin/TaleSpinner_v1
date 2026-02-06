import { updatePartPayloadText } from "../../chat-entry-parts/parts-repository";
import { updateAssistantText } from "../../chat-core/chats-repository";
import { streamGlobalChat } from "../../llm/llm-service";

import type { RunRequest, RunState } from "../contracts";

const DEFAULT_FLUSH_MS = 750;

export async function runMainLlmPhase(params: {
  request: RunRequest;
  runState: RunState;
  ownerId: string;
  abortController: AbortController;
  onDelta: (content: string) => void;
}): Promise<{ status: "done" | "aborted" | "error"; message?: string }> {
  let flushing = Promise.resolve();
  let closed = false;

  const flush = async (force = false): Promise<void> => {
    flushing = flushing.then(async () => {
      if (closed && !force) return;
      if (params.request.persistenceTarget.mode === "entry_parts") {
        await updatePartPayloadText({
          partId: params.request.persistenceTarget.assistantMainPartId,
          payloadText: params.runState.assistantText,
          payloadFormat: "markdown",
        });
        return;
      }

      await updateAssistantText({
        assistantMessageId: params.request.persistenceTarget.assistantMessageId,
        variantId: params.request.persistenceTarget.variantId,
        text: params.runState.assistantText,
      });
    });
    await flushing;
  };

  const timer = setInterval(() => {
    void flush(false);
  }, params.request.flushMs ?? DEFAULT_FLUSH_MS);

  try {
    const messageStream = streamGlobalChat({
      messages: params.runState.llmMessages,
      settings: params.request.settings ?? {},
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
    }

    return { status: "done" };
  } finally {
    closed = true;
    clearInterval(timer);
    await flush(true);
  }
}
