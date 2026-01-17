import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import {
  customOpenAiConfigSchema,
  llmProviderDefinitions,
  openRouterConfigSchema,
  type LlmProviderId,
} from "@services/llm/llm-definitions";
import {
  createToken,
  deleteToken,
  getProviderConfig,
  getRuntime,
  getRuntimeProviderState,
  listProviders,
  listTokens,
  upsertProviderConfig,
  upsertRuntimeProviderState,
  upsertRuntime,
  updateToken,
} from "@services/llm/llm-repository";
import { getModels } from "@services/llm/llm-service";

const router = express.Router();

const providerIdSchema = z.enum(["openrouter", "custom_openai"]);

const scopeSchema = z.enum(["global", "agent"]);

const runtimeQuerySchema = z.object({
  scope: scopeSchema.optional().default("global"),
  scopeId: z.string().min(1).optional().default("global"),
});

const runtimePatchSchema = z.object({
  scope: scopeSchema.optional().default("global"),
  scopeId: z.string().min(1).optional().default("global"),
  activeProviderId: providerIdSchema,
  activeTokenId: z.string().min(1).nullable().optional(),
  activeModel: z.string().min(1).nullable().optional(),
});

router.get(
  "/llm/providers",
  asyncHandler(async () => {
    const rows = await listProviders();
    const enabledById = new Map(rows.map((r) => [r.id, r.enabled]));

    const providers = llmProviderDefinitions.map((d) => ({
      ...d,
      enabled: enabledById.get(d.id) ?? d.enabledByDefault,
    }));

    return { data: { providers } };
  })
);

router.get(
  "/llm/runtime",
  validate({ query: runtimeQuerySchema }),
  asyncHandler(async (req: Request) => {
    const { scope, scopeId } = runtimeQuerySchema.parse(req.query);
    const runtime = await getRuntime(scope, scopeId);

    let activeTokenHint: string | null = null;
    if (runtime.activeTokenId) {
      const tokens = await listTokens(runtime.activeProviderId);
      activeTokenHint =
        tokens.find((t) => t.id === runtime.activeTokenId)?.tokenHint ?? null;
    }

    return { data: { ...runtime, activeTokenHint } };
  })
);

router.patch(
  "/llm/runtime",
  validate({ body: runtimePatchSchema }),
  asyncHandler(async (req: Request) => {
    const body = req.body as z.infer<typeof runtimePatchSchema>;
    const scope = body.scope;
    const scopeId = body.scopeId;

    const current = await getRuntime(scope, scopeId);
    const nextProviderId = body.activeProviderId as LlmProviderId;

    // If provider changes, persist current selection as "last used" for that provider,
    // then restore last selection for the next provider (unless explicitly overridden).
    if (current.activeProviderId !== nextProviderId) {
      await upsertRuntimeProviderState({
        scope,
        scopeId,
        providerId: current.activeProviderId,
        lastTokenId: current.activeTokenId,
        lastModel: current.activeModel,
      });
    }

    let nextTokenId: string | null =
      body.activeTokenId !== undefined ? body.activeTokenId ?? null : null;
    let nextModel: string | null =
      body.activeModel !== undefined ? body.activeModel ?? null : null;

    if (current.activeProviderId !== nextProviderId) {
      const restored = await getRuntimeProviderState({
        scope,
        scopeId,
        providerId: nextProviderId,
      });
      if (body.activeTokenId === undefined) {
        nextTokenId = restored.lastTokenId;
      }
      if (body.activeModel === undefined) {
        nextModel = restored.lastModel;
      }
    } else {
      // Same provider: keep current values if they were not included in patch.
      if (body.activeTokenId === undefined) {
        nextTokenId = current.activeTokenId;
      }
      if (body.activeModel === undefined) {
        nextModel = current.activeModel;
      }
    }

    const runtime = await upsertRuntime({
      scope,
      scopeId,
      activeProviderId: nextProviderId,
      activeTokenId: nextTokenId,
      activeModel: nextModel,
    });

    // Always persist latest selection for the active provider too.
    await upsertRuntimeProviderState({
      scope,
      scopeId,
      providerId: runtime.activeProviderId,
      lastTokenId: runtime.activeTokenId,
      lastModel: runtime.activeModel,
    });

    let activeTokenHint: string | null = null;
    if (runtime.activeTokenId) {
      const tokens = await listTokens(runtime.activeProviderId);
      activeTokenHint =
        tokens.find((t) => t.id === runtime.activeTokenId)?.tokenHint ?? null;
    }

    return { data: { ...runtime, activeTokenHint } };
  })
);

router.get(
  "/llm/providers/:providerId/config",
  validate({ params: z.object({ providerId: providerIdSchema }) }),
  asyncHandler(async (req: Request) => {
    const providerId = req.params.providerId as LlmProviderId;
    const config = await getProviderConfig(providerId);
    return { data: config };
  })
);

router.patch(
  "/llm/providers/:providerId/config",
  validate({
    params: z.object({ providerId: providerIdSchema }),
    body: z.unknown(),
  }),
  asyncHandler(async (req: Request) => {
    const providerId = req.params.providerId as LlmProviderId;

    const parsed =
      providerId === "openrouter"
        ? openRouterConfigSchema.parse(req.body)
        : customOpenAiConfigSchema.parse(req.body);

    const saved = await upsertProviderConfig(providerId, parsed);
    return { data: saved };
  })
);

router.get(
  "/llm/tokens",
  validate({ query: z.object({ providerId: providerIdSchema }) }),
  asyncHandler(async (req: Request) => {
    const providerId = providerIdSchema.parse(
      (req.query as unknown as { providerId?: unknown }).providerId
    ) as LlmProviderId;
    const tokens = await listTokens(providerId);
    return { data: { tokens } };
  })
);

const tokenCreateSchema = z.object({
  providerId: providerIdSchema,
  name: z.string().min(1),
  token: z.string().min(1),
});

router.post(
  "/llm/tokens",
  validate({ body: tokenCreateSchema }),
  asyncHandler(async (req: Request) => {
    const body = req.body as z.infer<typeof tokenCreateSchema>;
    const created = await createToken({
      providerId: body.providerId as LlmProviderId,
      name: body.name,
      token: body.token,
    });
    return { data: created };
  })
);

const tokenPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    token: z.string().optional(),
  })
  .refine((v) => v.name || v.token, { message: "Nothing to update" });

router.patch(
  "/llm/tokens/:id",
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: tokenPatchSchema,
  }),
  asyncHandler(async (req: Request) => {
    const id = String(req.params.id);
    const body = req.body as z.infer<typeof tokenPatchSchema>;
    await updateToken({ id, name: body.name, token: body.token });
    return { data: { success: true } };
  })
);

router.delete(
  "/llm/tokens/:id",
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req: Request) => {
    await deleteToken(String(req.params.id));
    return { data: { success: true } };
  })
);

router.get(
  "/llm/models",
  validate({
    query: z.object({
      providerId: providerIdSchema,
      scope: scopeSchema.optional().default("global"),
      scopeId: z.string().min(1).optional().default("global"),
      tokenId: z.string().min(1).optional(),
      modelOverride: z.string().min(1).optional(),
    }),
  }),
  asyncHandler(async (req: Request) => {
    const q = z
      .object({
        providerId: providerIdSchema,
        scope: scopeSchema.optional().default("global"),
        scopeId: z.string().min(1).optional().default("global"),
        tokenId: z.string().min(1).optional(),
        modelOverride: z.string().min(1).optional(),
      })
      .parse(req.query) as {
      providerId: LlmProviderId;
      scope: "global" | "agent";
      scopeId: string;
      tokenId?: string;
      modelOverride?: string;
    };

    const models = await getModels({
      providerId: q.providerId,
      scope: q.scope,
      scopeId: q.scopeId,
      tokenId: q.tokenId,
      modelOverride: q.modelOverride,
    });

    return { data: { models } };
  })
);

// Guardrail: expose only the new endpoints; legacy configs should not be used.
router.all(
  "/config/openrouter",
  asyncHandler(async () => {
    throw new HttpError(
      410,
      "Legacy endpoint removed",
      "LEGACY_ENDPOINT_REMOVED"
    );
  })
);

export default router;
