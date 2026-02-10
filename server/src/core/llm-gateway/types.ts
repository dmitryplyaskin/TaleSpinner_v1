import { z } from "zod";

export type LlmGatewayRole = "system" | "user" | "assistant";

export type LlmGatewayMessage = {
  role: LlmGatewayRole;
  content: string;
};

export type LlmSamplingParams = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  seed?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
};

export type LlmProviderSpec = {
  /**
   * Provider id used by internal registry (e.g. "openrouter", "openai").
   * Not tied to TaleSpinner runtime ids.
   */
  id: string;
  /** Provider auth token (API key). */
  token: string;
  /** Optional base URL for OpenAI-compatible providers. */
  baseUrl?: string;
  /** Provider-specific config blob (optional). */
  config?: unknown;
};

/**
 * Feature map is intentionally open for declaration merging.
 * Plugins can augment this interface to add typed feature keys.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LlmGatewayFeatureMap {}

export type LlmGatewayFeatures = Partial<LlmGatewayFeatureMap> & Record<string, unknown>;

export type LlmGatewayRequest = {
  provider: LlmProviderSpec;
  model: string;
  messages: LlmGatewayMessage[];
  sampling?: LlmSamplingParams;
  /**
   * Provider payload passthrough. This is merged into the final request payload.
   * Use for provider-specific fields not covered by `sampling`.
   */
  extra?: Record<string, unknown>;
  /**
   * Optional feature flags/options for internal gateway plugins.
   * Unknown feature keys are ignored but logged as warnings.
   */
  features?: LlmGatewayFeatures;
  stream?: boolean;
  abortSignal?: AbortSignal;
};

export type LlmGatewayDoneStatus = "done" | "aborted" | "error";

export type LlmGatewayStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reasoning_delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; status: LlmGatewayDoneStatus; warnings?: string[] };

export type LlmGatewayResult = {
  text: string;
  raw?: unknown;
  usage?: unknown;
  warnings?: string[];
};

export type LlmGatewayLogger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

export class LlmGatewayError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export type LlmGatewayProviderRequest = {
  provider: LlmProviderSpec;
  model: string;
  messages: LlmGatewayMessage[];
  /**
   * Normalized provider payload (model/messages + sampling + extra + plugin patches).
   * Provider adapters can further map it to a concrete SDK call.
   */
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  abortSignal?: AbortSignal;
};

export interface LlmProviderAdapter {
  readonly id: string;
  generate(req: LlmGatewayProviderRequest): Promise<LlmGatewayResult>;
  stream(req: LlmGatewayProviderRequest): AsyncGenerator<LlmGatewayStreamEvent>;
}

export type LlmGatewayPluginContext = {
  providerId: string;
  model: string;
  features: Record<string, unknown>;
};

export type LlmGatewayNormalizeMessagesResult = {
  messages: LlmGatewayMessage[];
  warnings?: string[];
};

export type LlmGatewayMutateRequestResult = {
  payloadPatch?: Record<string, unknown>;
  headersPatch?: Record<string, string>;
  warnings?: string[];
};

export type LlmGatewayPluginExecutionContext = {
  providerId: string;
  model: string;
  messages: LlmGatewayMessage[];
  sampling: LlmSamplingParams;
  extra: Record<string, unknown>;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  features: Record<string, unknown>;
  logger: LlmGatewayLogger;
  abortSignal?: AbortSignal;
};

export interface LlmGatewayPlugin<Feature = unknown> {
  /** Unique id (also used as key in `features`). */
  readonly id: string;
  /** Optional zod schema for `features[id]`. */
  readonly schema?: z.ZodType<Feature>;
  /**
   * Match is optional; if omitted plugin is always active.
   * Can match by provider/model and feature presence.
   */
  match?: (ctx: LlmGatewayPluginContext) => boolean;

  normalizeMessages?(
    ctx: LlmGatewayPluginExecutionContext,
    feature: Feature | undefined
  ): LlmGatewayNormalizeMessagesResult;

  mutateRequest?(
    ctx: LlmGatewayPluginExecutionContext,
    feature: Feature | undefined
  ): LlmGatewayMutateRequestResult;

  /**
   * Optional non-stream cache wrapper. If provided, plugin may short-circuit.
   * NOTE: This hook is not used for streaming calls.
   */
  cache?(
    ctx: LlmGatewayPluginExecutionContext,
    feature: Feature | undefined,
    next: () => Promise<LlmGatewayResult>
  ): Promise<LlmGatewayResult>;

  transformResult?(
    ctx: LlmGatewayPluginExecutionContext,
    feature: Feature | undefined,
    result: LlmGatewayResult
  ): LlmGatewayResult;

  wrapStream?(
    stream: AsyncGenerator<LlmGatewayStreamEvent>,
    ctx: LlmGatewayPluginExecutionContext,
    feature: Feature | undefined
  ): AsyncGenerator<LlmGatewayStreamEvent>;
}

