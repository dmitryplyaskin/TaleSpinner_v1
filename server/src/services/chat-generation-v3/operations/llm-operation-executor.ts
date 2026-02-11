import { llmGateway } from "@core/llm-gateway";
import type { GenerateMessage } from "@shared/types/generate";
import type { OperationInProfile } from "@shared/types/operation-profiles";

import { renderLiquidTemplate, type PromptTemplateRenderContext } from "../../chat-core/prompt-template-renderer";
import { buildGatewayStreamRequest } from "../../llm/llm-gateway-adapter";
import { getProviderConfig, getTokenPlaintext } from "../../llm/llm-repository";
import { parseLlmOperationParams } from "../../operations/llm-operation-params";

type LlmOperation = Extract<OperationInProfile, { kind: "llm" }>;

type CodedError = Error & { code: string };

function createCodedError(code: string, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  return error;
}

function createAbortError(message = "aborted"): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) return error.name === "AbortError";
  const asRecord = error as { name?: unknown };
  return asRecord.name === "AbortError";
}

function classifyProviderError(message: string): CodedError {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes("rate limit") || normalized.includes("rate_limit") || normalized.includes("429")) {
    return createCodedError("LLM_RATE_LIMIT", message);
  }
  return createCodedError("LLM_PROVIDER_ERROR", message);
}

function normalizeError(error: unknown): CodedError {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown };
    if (typeof withCode.code === "string") {
      const coded = new Error(error.message) as CodedError;
      coded.code = withCode.code;
      coded.name = error.name;
      return coded;
    }
    return classifyProviderError(error.message);
  }
  return classifyProviderError(String(error));
}

function toGatewaySettings(
  samplers: ReturnType<typeof parseLlmOperationParams>["samplers"]
): Record<string, unknown> {
  if (!samplers) return {};
  const settings: Record<string, unknown> = {};
  if (typeof samplers.temperature === "number") settings.temperature = samplers.temperature;
  if (typeof samplers.topP === "number") settings.topP = samplers.topP;
  if (typeof samplers.topK === "number") settings.topK = samplers.topK;
  if (typeof samplers.frequencyPenalty === "number") settings.frequencyPenalty = samplers.frequencyPenalty;
  if (typeof samplers.presencePenalty === "number") settings.presencePenalty = samplers.presencePenalty;
  if (typeof samplers.seed === "number") settings.seed = samplers.seed;
  if (typeof samplers.maxTokens === "number") settings.maxTokens = samplers.maxTokens;
  return settings;
}

function createAttemptSignal(parent: AbortSignal | undefined, timeoutMs: number | undefined): {
  signal: AbortSignal;
  isTimedOut: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | null = null;

  const abortFromParent = (): void => {
    controller.abort((parent as unknown as { reason?: unknown })?.reason);
  };

  if (parent) {
    if (parent.aborted) {
      abortFromParent();
    } else {
      parent.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("timeout"));
    }, timeoutMs);
  }

  const dispose = (): void => {
    if (parent) {
      parent.removeEventListener("abort", abortFromParent);
    }
    if (timeoutHandle) clearTimeout(timeoutHandle);
  };

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    dispose,
  };
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError());
    };

    if (!signal) return;
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function normalizeOutputByMode(text: string, mode: "text" | "json"): string {
  if (mode === "text") return text;
  try {
    return JSON.stringify(JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createCodedError("LLM_OUTPUT_PARSE_ERROR", `Failed to parse JSON output: ${message}`);
  }
}

function toRetryReason(code: string): "timeout" | "provider_error" | "rate_limit" | null {
  if (code === "LLM_TIMEOUT") return "timeout";
  if (code === "LLM_PROVIDER_ERROR") return "provider_error";
  if (code === "LLM_RATE_LIMIT") return "rate_limit";
  return null;
}

async function callLlmOnce(params: {
  providerId: "openrouter" | "openai_compatible";
  token: string;
  providerConfig: unknown;
  model?: string;
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}): Promise<string> {
  const attemptSignal = createAttemptSignal(params.abortSignal, params.timeoutMs);

  try {
    if (params.abortSignal?.aborted) throw createAbortError();

    const request = buildGatewayStreamRequest({
      providerId: params.providerId,
      token: params.token,
      providerConfig: params.providerConfig,
      runtimeModel: params.model ?? null,
      messages: params.messages,
      settings: params.settings,
      abortSignal: attemptSignal.signal,
    });

    let text = "";
    let providerError: string | null = null;

    for await (const event of llmGateway.stream(request)) {
      if (event.type === "delta") {
        text += event.text;
        continue;
      }
      if (event.type === "error") {
        providerError = event.message;
        continue;
      }
      if (event.type === "done") {
        if (event.status === "aborted") {
          if (params.abortSignal?.aborted) throw createAbortError();
          if (attemptSignal.isTimedOut()) {
            throw createCodedError("LLM_TIMEOUT", "LLM request timed out");
          }
          throw createCodedError("LLM_PROVIDER_ERROR", "LLM request aborted by provider");
        }
        if (event.status === "error") {
          providerError = providerError ?? event.warnings?.[0] ?? "Provider stream failed";
        }
        break;
      }
    }

    if (attemptSignal.isTimedOut()) {
      throw createCodedError("LLM_TIMEOUT", "LLM request timed out");
    }
    if (providerError) throw classifyProviderError(providerError);

    return text;
  } catch (error) {
    if (attemptSignal.isTimedOut()) {
      throw createCodedError("LLM_TIMEOUT", "LLM request timed out");
    }
    if (isAbortError(error) && params.abortSignal?.aborted) {
      throw createAbortError();
    }
    throw normalizeError(error);
  } finally {
    attemptSignal.dispose();
  }
}

export async function executeLlmOperation(params: {
  op: LlmOperation;
  liquidContext: PromptTemplateRenderContext;
  abortSignal?: AbortSignal;
}): Promise<{ rendered: string; debugSummary: string }> {
  let llmParams: ReturnType<typeof parseLlmOperationParams>;
  try {
    llmParams = parseLlmOperationParams(params.op.config.params.params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createCodedError("LLM_INVALID_PARAMS", message);
  }

  let renderedPrompt = "";
  let renderedSystem = "";
  try {
    renderedPrompt = String(
      await renderLiquidTemplate({
        templateText: llmParams.prompt,
        context: params.liquidContext,
        options: { strictVariables: llmParams.strictVariables },
      })
    );
    if (typeof llmParams.system === "string" && llmParams.system.length > 0) {
      renderedSystem = String(
        await renderLiquidTemplate({
          templateText: llmParams.system,
          context: params.liquidContext,
          options: { strictVariables: llmParams.strictVariables },
        })
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createCodedError("LLM_TEMPLATE_RENDER_ERROR", message);
  }

  let token: string | null = null;
  try {
    token = await getTokenPlaintext(llmParams.credentialRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createCodedError("LLM_PROVIDER_ERROR", message);
  }
  if (!token) {
    throw createCodedError("LLM_TOKEN_NOT_FOUND", "LLM credentialRef token not found");
  }

  let providerConfig: Awaited<ReturnType<typeof getProviderConfig>>;
  try {
    providerConfig = await getProviderConfig(llmParams.providerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createCodedError("LLM_PROVIDER_ERROR", message);
  }
  const settings = toGatewaySettings(llmParams.samplers);

  const messages: GenerateMessage[] = [];
  if (renderedSystem.trim().length > 0) {
    messages.push({ role: "system", content: renderedSystem });
  }
  messages.push({ role: "user", content: renderedPrompt });

  const maxAttempts = llmParams.retry?.maxAttempts ?? 1;
  const retryOn = new Set(llmParams.retry?.retryOn ?? []);
  const backoffMs = llmParams.retry?.backoffMs ?? 0;

  let attempt = 0;
  for (; attempt < maxAttempts; attempt += 1) {
    try {
      const text = await callLlmOnce({
        providerId: llmParams.providerId,
        token,
        providerConfig: providerConfig.config,
        model: llmParams.model,
        messages,
        settings,
        abortSignal: params.abortSignal,
        timeoutMs: llmParams.timeoutMs,
      });
      const rendered = normalizeOutputByMode(text, llmParams.outputMode);
      return {
        rendered,
        debugSummary: `llm:${llmParams.outputMode}:${rendered.length}:attempts=${attempt + 1}`,
      };
    } catch (error) {
      if (isAbortError(error)) throw error;
      const normalized = normalizeError(error);
      const retryReason = toRetryReason(normalized.code);
      const canRetry =
        retryReason !== null && retryOn.has(retryReason) && attempt < maxAttempts - 1;
      if (!canRetry) throw normalized;
      await sleepWithAbort(backoffMs, params.abortSignal);
    }
  }

  throw createCodedError("LLM_PROVIDER_ERROR", "LLM operation failed");
}
