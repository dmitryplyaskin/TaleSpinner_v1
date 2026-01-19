import { HttpError } from "@core/middleware/error-handler";

import { getProvider } from "./llm-provider-registry";
import {
  getProviderConfig,
  getRuntime,
  getTokenPlaintext,
  listProviders,
  listTokens,
  touchTokenLastUsed,
  type LlmRuntimeRow,
  type LlmScope,
} from "./llm-repository";

import type { LlmProviderId } from "./llm-definitions";
import type { GenerateMessage } from "@shared/types/generate";

export async function getRuntimeOrThrow(
  scope: LlmScope,
  scopeId: string
): Promise<LlmRuntimeRow> {
  return getRuntime(scope, scopeId);
}

export async function getProvidersForUi(): Promise<
  Array<{ id: LlmProviderId; name: string; enabled: boolean }>
> {
  return listProviders();
}

export async function getTokensForUi(
  providerId: LlmProviderId
): Promise<Array<{ id: string; name: string; tokenHint: string }>> {
  const tokens = await listTokens(providerId);
  return tokens.map((t) => ({
    id: t.id,
    name: t.name,
    tokenHint: t.tokenHint,
  }));
}

export async function getModels(params: {
  providerId: LlmProviderId;
  scope: LlmScope;
  scopeId: string;
  tokenId?: string | null;
  modelOverride?: string | null;
}): Promise<Array<{ id: string; name: string }>> {
  const runtime = await getRuntime(params.scope, params.scopeId);
  const tokenId = params.tokenId ?? runtime.activeTokenId;
  if (!tokenId) {
    return [];
  }

  const token = await getTokenPlaintext(tokenId);
  if (!token) {
    return [];
  }

  const config = await getProviderConfig(params.providerId);
  const provider = getProvider(params.providerId);
  try {
    return await provider.getModels({
      providerId: params.providerId,
      token,
      model: params.modelOverride ?? runtime.activeModel ?? "",
      config: config.config,
    });
  } catch (error) {
    // Models are optional for UX; don't fail hard.
    console.warn("Failed to fetch models", {
      providerId: params.providerId,
      error,
    });
    return [];
  }
}

export async function* streamGlobalChat(params: {
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  scopeId?: string;
  abortController?: AbortController;
}): AsyncGenerator<{ content: string; error: string | null }> {
  const runtime = await getRuntime("global", params.scopeId ?? "global");
  const providerId = runtime.activeProviderId;
  const tokenId = runtime.activeTokenId;
  if (!tokenId) {
    throw new HttpError(
      400,
      "No active token configured for the selected provider",
      "LLM_TOKEN_MISSING"
    );
  }

  const token = await getTokenPlaintext(tokenId);
  if (!token) {
    throw new HttpError(400, "Active token not found", "LLM_TOKEN_NOT_FOUND");
  }

  const config = await getProviderConfig(providerId);
  const provider = getProvider(providerId);

  await touchTokenLastUsed(tokenId);

  yield* provider.streamChat({
    ctx: {
      providerId,
      token,
      model: runtime.activeModel ?? "",
      config: config.config,
    },
    messages: params.messages,
    settings: params.settings,
    abortController: params.abortController,
  });
}
