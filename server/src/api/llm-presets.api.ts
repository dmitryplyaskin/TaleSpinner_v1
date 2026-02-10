import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  applyLlmPreset,
  createLlmPreset,
  deleteLlmPreset,
  getLlmPresetSettings,
  listLlmPresets,
  patchLlmPresetSettings,
  updateLlmPreset,
} from "../services/llm/llm-presets-repository";
import { listTokens } from "../services/llm/llm-repository";

const router = express.Router();

const ownerIdSchema = z.string().min(1).optional();
const presetIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

const providerConfigMapSchema = z
  .object({
    openrouter: z.record(z.string(), z.unknown()).optional(),
    openai_compatible: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const presetPayloadSchema = z
  .object({
    activeProviderId: z.enum(["openrouter", "openai_compatible"]),
    activeModel: z.string().min(1).nullable(),
    activeTokenId: z.string().min(1).nullable(),
    providerConfigsById: providerConfigMapSchema,
  })
  .strict();

const createBodySchema = z
  .object({
    ownerId: ownerIdSchema,
    name: z.string().min(1).max(256),
    description: z.string().max(1024).optional(),
    payload: presetPayloadSchema,
  })
  .strict();

const updateBodySchema = z
  .object({
    ownerId: ownerIdSchema,
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(1024).nullable().optional(),
    payload: presetPayloadSchema.optional(),
  })
  .strict();

const applyBodySchema = z
  .object({
    ownerId: ownerIdSchema,
    scope: z.enum(["global", "agent"]).optional(),
    scopeId: z.string().min(1).optional(),
  })
  .strict();

const settingsPatchSchema = z
  .object({
    ownerId: ownerIdSchema,
    activePresetId: z.string().min(1).nullable().optional(),
  })
  .strict();

router.get(
  "/llm-presets",
  validate({
    query: z
      .object({
        ownerId: ownerIdSchema,
      })
      .strict(),
  }),
  asyncHandler(async (req: Request) => {
    const ownerId = req.query.ownerId as string | undefined;
    const data = await listLlmPresets({ ownerId });
    return { data };
  })
);

router.post(
  "/llm-presets",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = createBodySchema.parse(req.body);
    const created = await createLlmPreset({
      ownerId: body.ownerId,
      name: body.name,
      description: body.description,
      payload: body.payload,
    });
    return { data: created };
  })
);

router.put(
  "/llm-presets/:id",
  validate({ params: presetIdParamsSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = presetIdParamsSchema.parse(req.params);
    const body = updateBodySchema.parse(req.body);
    if (
      typeof body.name === "undefined" &&
      typeof body.description === "undefined" &&
      typeof body.payload === "undefined"
    ) {
      throw new HttpError(400, "Patch is empty", "VALIDATION_ERROR");
    }
    const updated = await updateLlmPreset({
      ownerId: body.ownerId,
      presetId: params.id,
      name: body.name,
      description: body.description,
      payload: body.payload,
    });
    return { data: updated };
  })
);

router.delete(
  "/llm-presets/:id",
  validate({
    params: presetIdParamsSchema,
    query: z
      .object({
        ownerId: ownerIdSchema,
      })
      .strict(),
  }),
  asyncHandler(async (req: Request) => {
    const params = presetIdParamsSchema.parse(req.params);
    const ownerId = req.query.ownerId as string | undefined;
    await deleteLlmPreset({ ownerId, presetId: params.id });
    return { data: { id: params.id } };
  })
);

router.post(
  "/llm-presets/:id/apply",
  validate({ params: presetIdParamsSchema, body: applyBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = presetIdParamsSchema.parse(req.params);
    const body = applyBodySchema.parse(req.body);
    const applied = await applyLlmPreset({
      ownerId: body.ownerId,
      presetId: params.id,
      scope: body.scope,
      scopeId: body.scopeId,
    });
    let activeTokenHint: string | null = null;
    if (applied.runtime.activeTokenId) {
      const tokens = await listTokens(applied.runtime.activeProviderId);
      activeTokenHint =
        tokens.find((token) => token.id === applied.runtime.activeTokenId)
          ?.tokenHint ?? null;
    }
    await patchLlmPresetSettings({
      ownerId: body.ownerId,
      activePresetId: params.id,
    });
    return {
      data: {
        ...applied,
        runtime: {
          ...applied.runtime,
          activeTokenHint,
        },
      },
    };
  })
);

router.get(
  "/llm-preset-settings",
  validate({
    query: z
      .object({
        ownerId: ownerIdSchema,
      })
      .strict(),
  }),
  asyncHandler(async (req: Request) => {
    const ownerId = req.query.ownerId as string | undefined;
    const data = await getLlmPresetSettings({ ownerId });
    return { data };
  })
);

router.put(
  "/llm-preset-settings",
  validate({ body: settingsPatchSchema }),
  asyncHandler(async (req: Request) => {
    const body = settingsPatchSchema.parse(req.body);
    if (typeof body.activePresetId === "undefined") {
      throw new HttpError(400, "Patch is empty", "VALIDATION_ERROR");
    }
    const data = await patchLlmPresetSettings({
      ownerId: body.ownerId,
      activePresetId: body.activePresetId,
    });
    return { data };
  })
);

export default router;
export {
  createBodySchema as llmPresetCreateBodySchema,
  updateBodySchema as llmPresetUpdateBodySchema,
  applyBodySchema as llmPresetApplyBodySchema,
  settingsPatchSchema as llmPresetSettingsPatchSchema,
};
