import axios from "axios";

import { getTokenPlaintext } from "@services/llm/llm-repository";

import type {
  RagProviderConfig,
  RagProviderConnectionCheckResult,
  RagProviderId,
} from "@shared/types/rag";

const REQUEST_TIMEOUT_MS = 7000;

function getErrorDetails(error: unknown): {
  statusCode: number | null;
  message: string;
} {
  if (!error || typeof error !== "object") {
    return { statusCode: null, message: String(error) };
  }
  const value = error as {
    message?: unknown;
    response?: {
      status?: unknown;
      data?: { error?: { message?: unknown }; message?: unknown };
    };
  };
  const providerMessage =
    value.response?.data?.error?.message ?? value.response?.data?.message;
  return {
    statusCode:
      typeof value.response?.status === "number" ? value.response.status : null,
    message:
      typeof providerMessage === "string"
        ? providerMessage
        : typeof value.message === "string"
          ? value.message
          : "Provider request failed",
  };
}

function failure(
  providerId: RagProviderId,
  checkedUrl: string,
  issueCode: NonNullable<RagProviderConnectionCheckResult["issueCode"]>,
  message: string,
  statusCode: number | null = null
): RagProviderConnectionCheckResult {
  return {
    ok: false,
    providerId,
    issueCode,
    message,
    checkedUrl,
    statusCode,
    modelCount: 0,
  };
}

export async function probeRagProviderConnection(params: {
  providerId: RagProviderId;
  tokenId: string | null;
  config: RagProviderConfig;
}): Promise<RagProviderConnectionCheckResult> {
  const checkedUrl =
    params.providerId === "openrouter"
      ? "https://openrouter.ai/api/v1/embeddings/models"
      : `${String(params.config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "")}/api/tags`;

  if (params.providerId === "openrouter" && !params.tokenId) {
    return failure(
      params.providerId,
      checkedUrl,
      "TOKEN_MISSING",
      "Select an OpenRouter token before checking the connection."
    );
  }
  const token = params.tokenId ? await getTokenPlaintext(params.tokenId) : null;
  if (params.providerId === "openrouter" && !token) {
    return failure(
      params.providerId,
      checkedUrl,
      "TOKEN_NOT_FOUND",
      "The selected OpenRouter token could not be found."
    );
  }

  try {
    const response = await axios.get(
      checkedUrl,
      params.providerId === "openrouter"
        ? {
            headers: {
              "HTTP-Referer": "http://localhost:5000",
              "X-Title": "TaleSpinner",
              Authorization: `Bearer ${token}`,
            },
            timeout: REQUEST_TIMEOUT_MS,
          }
        : { timeout: REQUEST_TIMEOUT_MS }
    );
    const modelCount =
      params.providerId === "openrouter"
        ? (Array.isArray(response.data?.data) ? response.data.data.length : 0)
        : (Array.isArray(response.data?.models) ? response.data.models.length : 0);
    return {
      ok: true,
      providerId: params.providerId,
      issueCode: null,
      message: `Connection successful. ${modelCount} embedding model${modelCount === 1 ? "" : "s"} available.`,
      checkedUrl,
      statusCode: typeof response.status === "number" ? response.status : 200,
      modelCount,
    };
  } catch (error) {
    const details = getErrorDetails(error);
    const issueCode =
      details.statusCode === 401 || details.statusCode === 403
        ? "AUTH_ERROR"
        : details.statusCode === 404
          ? "ENDPOINT_NOT_FOUND"
          : details.statusCode === null
            ? "NETWORK_ERROR"
            : "PROVIDER_ERROR";
    return failure(
      params.providerId,
      checkedUrl,
      issueCode,
      details.message,
      details.statusCode
    );
  }
}
