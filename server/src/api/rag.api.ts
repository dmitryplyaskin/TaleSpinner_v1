import express, { type Request } from 'express';
import { z } from 'zod';

import { asyncHandler } from '@core/middleware/async-handler';
import { HttpError } from '@core/middleware/error-handler';
import { validate } from '@core/middleware/validate';
import {
  ensureRagPresetState,
  generateRagEmbedding,
  getRagProviderConfig,
  getRagRuntime,
  listRagModels,
  listRagTokens,
  patchRagProviderConfig,
  patchRagRuntime,
  ragPresetSchema,
  ragPresetSettingsSchema,
  ragProviderDefinitions,
  ragService,
} from '@services/rag.service';

import type { RagProviderId } from '@shared/types/rag';

const router = express.Router();

export const ragProviderIdSchema = z.enum(['openrouter', 'ollama'] satisfies RagProviderId[]);
export const ragRuntimePatchBodySchema = z.object({
  activeProviderId: ragProviderIdSchema.optional(),
  activeTokenId: z.string().min(1).nullable().optional(),
  activeModel: z.string().min(1).nullable().optional(),
});
export const ragProviderParamsSchema = z.object({ providerId: ragProviderIdSchema });
export const ragTokensQuerySchema = z.object({ providerId: ragProviderIdSchema });
export const ragModelsQuerySchema = z.object({
  providerId: ragProviderIdSchema,
  tokenId: z.string().min(1).optional(),
});
export const ragEmbeddingsBodySchema = z.object({
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
});
export const ragPresetCreateBodySchema = ragPresetSchema;
export const ragPresetUpdateBodySchema = ragPresetSchema;
export const ragPresetSettingsPatchBodySchema = ragPresetSettingsSchema;
const ragPresetParamsSchema = z.object({ id: z.string().min(1) });

router.get('/rag/providers', asyncHandler(async () => {
  return { data: { providers: ragProviderDefinitions } };
}));

router.get('/rag/runtime', asyncHandler(async () => {
  return { data: await getRagRuntime() };
}));

router.patch('/rag/runtime', validate({ body: ragRuntimePatchBodySchema }), asyncHandler(async (req: Request) => {
  return { data: await patchRagRuntime(req.body) };
}));

router.get('/rag/providers/:providerId/config', validate({ params: ragProviderParamsSchema }), asyncHandler(async (req: Request) => {
  const providerId = req.params.providerId as RagProviderId;
  return { data: { providerId, config: await getRagProviderConfig(providerId) } };
}));

router.patch('/rag/providers/:providerId/config', validate({ params: ragProviderParamsSchema, body: z.unknown() }), asyncHandler(async (req: Request) => {
  const providerId = req.params.providerId as RagProviderId;
  return { data: { providerId, config: await patchRagProviderConfig(providerId, req.body) } };
}));

router.get('/rag/tokens', validate({ query: ragTokensQuerySchema }), asyncHandler(async (req: Request) => {
  const providerId = ragProviderIdSchema.parse((req.query as { providerId?: string }).providerId);
  const tokens = await listRagTokens(providerId);
  return { data: { tokens } };
}));

router.get('/rag/models', validate({ query: ragModelsQuerySchema }), asyncHandler(async (req: Request) => {
  const query = ragModelsQuerySchema.parse(req.query);
  let tokenId = query.tokenId ?? null;

  if (!tokenId) {
    const runtime = await getRagRuntime();
    if (runtime.activeProviderId === query.providerId) {
      tokenId = runtime.activeTokenId;
    }
  }

  const models = await listRagModels({
    providerId: query.providerId,
    tokenId,
  });

  return { data: { models } };
}));

router.get('/rag/presets', asyncHandler(async () => {
  const state = await ensureRagPresetState();
  return { data: state.presets };
}));

router.post('/rag/presets', validate({ body: ragPresetCreateBodySchema }), asyncHandler(async (req: Request) => {
  return { data: await ragService.presets.create(req.body as z.infer<typeof ragPresetCreateBodySchema>) };
}));

router.put('/rag/presets/:id', validate({ params: ragPresetParamsSchema, body: ragPresetUpdateBodySchema }), asyncHandler(async (req: Request) => {
  const id = String(req.params.id);
  const body = req.body as z.infer<typeof ragPresetUpdateBodySchema>;

  if (id !== body.id) {
    throw new HttpError(400, 'Path id must match body id', 'VALIDATION_ERROR', {
      pathId: id,
      bodyId: body.id,
    });
  }

  return { data: await ragService.presets.update(body) };
}));

router.delete('/rag/presets/:id', validate({ params: ragPresetParamsSchema }), asyncHandler(async (req: Request) => {
  const id = String(req.params.id);
  await ragService.presets.delete(id);
  await ensureRagPresetState();

  return { data: { id } };
}));

router.get('/settings/rag-presets', asyncHandler(async () => {
  const state = await ensureRagPresetState();
  return { data: state.settings };
}));

router.post('/settings/rag-presets', validate({ body: ragPresetSettingsPatchBodySchema }), asyncHandler(async (req: Request) => {
  const patch = req.body as z.infer<typeof ragPresetSettingsPatchBodySchema>;
  const state = await ensureRagPresetState();
  const presetIds = new Set(state.presets.map((item) => item.id));

  let selectedId = patch.selectedId ?? state.settings.selectedId;
  if (selectedId && !presetIds.has(selectedId)) {
    throw new HttpError(400, 'Selected preset not found', 'VALIDATION_ERROR', { selectedId });
  }
  if (!selectedId) {
    selectedId = state.presets[0]?.id ?? null;
  }

  return { data: await ragService.presetSettings.saveConfig({ selectedId }) };
}));

router.post('/rag/presets/:id/apply', validate({ params: ragPresetParamsSchema }), asyncHandler(async (req: Request) => {
  const state = await ensureRagPresetState();
  const list = state.presets;
  const preset = list.find((item) => item.id === req.params.id);
  if (!preset) return { data: { preset: null } };

  await patchRagRuntime({
    activeProviderId: preset.payload.activeProviderId,
    activeTokenId: preset.payload.activeTokenId,
    activeModel: preset.payload.activeModel,
  });

  const configs = await ragService.providerConfigs.getConfig();
  const nextConfigs = {
    ...configs,
    ...preset.payload.providerConfigsById,
  };
  await ragService.providerConfigs.saveConfig(nextConfigs);
  await ragService.presetSettings.saveConfig({ selectedId: preset.id });

  return { data: { preset } };
}));

router.post('/rag/embeddings', validate({ body: ragEmbeddingsBodySchema }), asyncHandler(async (req: Request) => {
  return { data: await generateRagEmbedding(req.body) };
}));

export default router;
