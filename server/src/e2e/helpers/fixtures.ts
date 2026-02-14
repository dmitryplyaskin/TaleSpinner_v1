import { requestJson } from "./http";

type ApiEnvelope<T> = { data: T };

export async function configureLlmOpenAiCompatible(params: {
  baseUrl: string;
  mockBaseUrl: string;
  model: string;
  token: string;
}): Promise<{ tokenId: string }> {
  const tokenRes = await requestJson<ApiEnvelope<{ id: string }>>({
    baseUrl: params.baseUrl,
    method: "POST",
    path: "/api/llm/tokens",
    body: {
      providerId: "openai_compatible",
      name: `token-${params.token}`,
      token: params.token,
    },
  });
  if (tokenRes.status !== 200) {
    throw new Error(`Failed to create token: ${tokenRes.status}`);
  }

  const tokenId = tokenRes.data.data.id;

  const configRes = await requestJson({
    baseUrl: params.baseUrl,
    method: "PATCH",
    path: "/api/llm/providers/openai_compatible/config",
    body: {
      baseUrl: `${params.mockBaseUrl}/v1`,
      defaultModel: params.model,
    },
  });
  if (configRes.status !== 200) {
    throw new Error(`Failed to patch provider config: ${configRes.status}`);
  }

  const runtimeRes = await requestJson({
    baseUrl: params.baseUrl,
    method: "PATCH",
    path: "/api/llm/runtime",
    body: {
      scope: "global",
      scopeId: "global",
      activeProviderId: "openai_compatible",
      activeTokenId: tokenId,
      activeModel: params.model,
    },
  });
  if (runtimeRes.status !== 200) {
    throw new Error(`Failed to patch runtime: ${runtimeRes.status}`);
  }

  return { tokenId };
}

export async function createEntityProfileAndChat(params: {
  baseUrl: string;
  name?: string;
}): Promise<{ entityProfileId: string; chatId: string; branchId: string }> {
  const profileRes = await requestJson<ApiEnvelope<{ id: string }>>({
    baseUrl: params.baseUrl,
    method: "POST",
    path: "/api/entity-profiles",
    body: {
      name: params.name ?? "E2E Profile",
      kind: "CharSpec",
      spec: {
        name: params.name ?? "E2E Profile",
        description: "fixture",
      },
    },
  });
  if (profileRes.status !== 200) {
    throw new Error(`Failed to create profile: ${profileRes.status}`);
  }
  const entityProfileId = profileRes.data.data.id;

  const chatRes = await requestJson<ApiEnvelope<{ chat: { id: string }; mainBranch: { id: string } }>>({
    baseUrl: params.baseUrl,
    method: "POST",
    path: `/api/entity-profiles/${entityProfileId}/chats`,
    body: {
      title: "E2E Chat",
    },
  });
  if (chatRes.status !== 200) {
    throw new Error(`Failed to create chat: ${chatRes.status}`);
  }

  return {
    entityProfileId,
    chatId: chatRes.data.data.chat.id,
    branchId: chatRes.data.data.mainBranch.id,
  };
}
