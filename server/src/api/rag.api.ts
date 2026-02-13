import express, { type Request } from 'express';
import { z } from 'zod';

import { asyncHandler } from '@core/middleware/async-handler';
import { HttpError } from '@core/middleware/error-handler';
import { validate } from '@core/middleware/validate';
import {
  generateRagEmbedding,
  getRagProviderConfig,
  getRagRuntime,
  listRagTokens,
  patchRagProviderConfig,
  patchRagRuntime,
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
export const ragEmbeddingsBodySchema = z.object({
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
});

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

router.get('/rag/presets', asyncHandler(async () => {
  return { data: await ragService.presets.getAll() };
}));

router.post('/rag/presets', asyncHandler(async (req: Request) => {
  return { data: await ragService.presets.create(req.body) };
}));

router.put('/rag/presets/:id', asyncHandler(async (req: Request) => {
  return { data: await ragService.presets.update(req.body) };
}));

router.delete('/rag/presets/:id', asyncHandler(async (req: Request) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    throw new HttpError(400, 'id is required', 'VALIDATION_ERROR');
  }
  await ragService.presets.delete(id);
  return { data: { id } };
}));

router.get('/settings/rag-presets', asyncHandler(async () => {
  return { data: await ragService.presetSettings.getConfig() };
}));

router.post('/settings/rag-presets', asyncHandler(async (req: Request) => {
  return { data: await ragService.presetSettings.saveConfig(req.body) };
}));

router.post('/rag/presets/:id/apply', asyncHandler(async (req: Request) => {
  const list = await ragService.presets.getAll();
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

  return { data: { preset } };
}));

router.post('/rag/embeddings', validate({ body: ragEmbeddingsBodySchema }), asyncHandler(async (req: Request) => {
  return { data: await generateRagEmbedding(req.body) };
}));

export default router;
