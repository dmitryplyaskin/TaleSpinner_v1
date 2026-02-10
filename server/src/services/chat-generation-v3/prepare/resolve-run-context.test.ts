import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGeneration: vi.fn(),
  resolveGatewayModel: vi.fn(),
  getRuntime: vi.fn(),
  getProviderConfig: vi.fn(),
  getOperationProfileSettings: vi.fn(),
  getOperationProfileById: vi.fn(),
}));

vi.mock("../../chat-core/generations-repository", () => ({
  createGeneration: mocks.createGeneration,
}));

vi.mock("../../llm/llm-gateway-adapter", () => ({
  resolveGatewayModel: mocks.resolveGatewayModel,
}));

vi.mock("../../llm/llm-repository", () => ({
  getRuntime: mocks.getRuntime,
  getProviderConfig: mocks.getProviderConfig,
}));

vi.mock("../../operations/operation-profile-settings-repository", () => ({
  getOperationProfileSettings: mocks.getOperationProfileSettings,
}));

vi.mock("../../operations/operation-profiles-repository", () => ({
  getOperationProfileById: mocks.getOperationProfileById,
}));

import { resolveRunContext } from "./resolve-run-context";

function makeRequest(overrides?: Partial<Parameters<typeof resolveRunContext>[0]["request"]>) {
  return {
    ownerId: "owner-1",
    chatId: "chat-1",
    branchId: "branch-1",
    entityProfileId: "entity-1",
    trigger: "generate" as const,
    settings: {
      __chatGenerationDebug: true,
      temperature: 0.7,
    },
    persistenceTarget: {
      mode: "entry_parts" as const,
      assistantEntryId: "assistant-entry-1",
      assistantMainPartId: "assistant-main-part-1",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

  mocks.getRuntime.mockResolvedValue({
    scope: "global",
    scopeId: "owner-1",
    activeProviderId: "openrouter",
    activeTokenId: null,
    activeModel: "runtime-model",
  });
  mocks.getProviderConfig.mockResolvedValue({
    providerId: "openrouter",
    config: { defaultModel: "provider-default" },
  });
  mocks.resolveGatewayModel.mockReturnValue("resolved-model");
  mocks.getOperationProfileSettings.mockResolvedValue({
    activeProfileId: null,
    updatedAt: new Date("2026-02-10T00:00:00.000Z"),
  });
  mocks.getOperationProfileById.mockResolvedValue(null);
  mocks.createGeneration.mockResolvedValue({
    id: "gen-1",
    startedAt: new Date("2026-02-10T00:00:01.000Z"),
  });
});

describe("resolveRunContext", () => {
  test("builds context with defaults and strips debug setting from generation payload", async () => {
    const request = makeRequest({ historyLimit: undefined });
    const { context, profile } = await resolveRunContext({ request });

    expect(mocks.getRuntime).toHaveBeenCalledWith("global", "owner-1");
    expect(mocks.getProviderConfig).toHaveBeenCalledWith("openrouter");
    expect(mocks.resolveGatewayModel).toHaveBeenCalledWith({
      providerId: "openrouter",
      runtimeModel: "runtime-model",
      providerConfig: { defaultModel: "provider-default" },
    });
    expect(mocks.createGeneration).toHaveBeenCalledWith({
      ownerId: "owner-1",
      chatId: "chat-1",
      branchId: "branch-1",
      messageId: null,
      variantId: null,
      providerId: "openrouter",
      model: "resolved-model",
      settings: { temperature: 0.7 },
    });

    expect(profile).toBeNull();
    expect(context).toMatchObject({
      ownerId: "owner-1",
      runId: "gen-1",
      generationId: "gen-1",
      trigger: "generate",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "entity-1",
      historyLimit: 50,
      sessionKey: null,
      profileSnapshot: null,
      runtimeInfo: {
        providerId: "openrouter",
        model: "resolved-model",
      },
      startedAt: 1_700_000_000_000,
    });
  });

  test("uses global owner fallback and custom historyLimit", async () => {
    const request = makeRequest({
      ownerId: undefined,
      historyLimit: 123,
    });
    await resolveRunContext({ request });

    expect(mocks.getRuntime).toHaveBeenCalledWith("global", "global");
    expect(mocks.createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "global",
      })
    );

    const { context } = await resolveRunContext({ request });
    expect(context.historyLimit).toBe(123);
  });

  test("loads enabled active profile and builds snapshot + session key", async () => {
    mocks.getOperationProfileSettings.mockResolvedValue({
      activeProfileId: "profile-1",
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });
    mocks.getOperationProfileById.mockResolvedValue({
      profileId: "profile-1",
      ownerId: "global",
      name: "P",
      enabled: true,
      executionMode: "concurrent",
      operationProfileSessionId: "sess-1",
      version: 7,
      operations: [],
      meta: null,
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });

    const { context, profile } = await resolveRunContext({ request: makeRequest() });

    expect(mocks.getOperationProfileById).toHaveBeenCalledWith("profile-1");
    expect(profile).toMatchObject({
      profileId: "profile-1",
      enabled: true,
    });
    expect(context.profileSnapshot).toEqual({
      profileId: "profile-1",
      version: 7,
      executionMode: "concurrent",
      operationProfileSessionId: "sess-1",
      operations: [],
    });
    expect(context.sessionKey).toBe("owner-1:chat-1:branch-1:profile-1:7:sess-1");
  });

  test("ignores active profile when disabled", async () => {
    mocks.getOperationProfileSettings.mockResolvedValue({
      activeProfileId: "profile-disabled",
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });
    mocks.getOperationProfileById.mockResolvedValue({
      profileId: "profile-disabled",
      ownerId: "global",
      name: "P2",
      enabled: false,
      executionMode: "sequential",
      operationProfileSessionId: "sess-2",
      version: 1,
      operations: [],
      meta: null,
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });

    const { context, profile } = await resolveRunContext({ request: makeRequest() });

    expect(profile).toBeNull();
    expect(context.profileSnapshot).toBeNull();
    expect(context.sessionKey).toBeNull();
  });

  test("does not load profile entity when no activeProfileId", async () => {
    mocks.getOperationProfileSettings.mockResolvedValue({
      activeProfileId: null,
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });

    await resolveRunContext({ request: makeRequest() });

    expect(mocks.getOperationProfileById).not.toHaveBeenCalled();
  });
});
