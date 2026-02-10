import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  createUiThemePreset,
  deleteUiThemePreset,
  exportUiThemePreset,
  getUiThemeSettings,
  importUiThemePresets,
  listUiThemePresets,
  patchUiThemeSettings,
  updateUiThemePreset,
} from "../services/ui-theme/ui-theme-repository";
import {
  uiThemeCreateSchema,
  uiThemeExportSchema,
  uiThemeSettingsPatchSchema,
  uiThemeUpdateSchema,
} from "../services/ui-theme/ui-theme-validator";

const router = express.Router();

const ownerQuerySchema = z
  .object({
    ownerId: z.string().min(1).optional(),
  })
  .strict();

const idParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

router.get(
  "/ui-theme-presets",
  validate({ query: ownerQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = ownerQuerySchema.parse(req.query);
    const data = await listUiThemePresets({ ownerId: query.ownerId });
    return { data };
  })
);

router.post(
  "/ui-theme-presets",
  validate({ body: uiThemeCreateSchema }),
  asyncHandler(async (req: Request) => {
    const body = uiThemeCreateSchema.parse(req.body);
    const data = await createUiThemePreset({
      ownerId: body.ownerId,
      name: body.name,
      description: body.description,
      payload: body.payload,
    });
    return { data };
  })
);

router.put(
  "/ui-theme-presets/:id",
  validate({ params: idParamsSchema, body: uiThemeUpdateSchema }),
  asyncHandler(async (req: Request) => {
    const params = idParamsSchema.parse(req.params);
    const body = uiThemeUpdateSchema.parse(req.body);
    if (
      typeof body.name === "undefined" &&
      typeof body.description === "undefined" &&
      typeof body.payload === "undefined"
    ) {
      throw new HttpError(400, "Patch is empty", "VALIDATION_ERROR");
    }
    const data = await updateUiThemePreset({
      ownerId: body.ownerId,
      presetId: params.id,
      name: body.name,
      description: body.description,
      payload: body.payload,
    });
    return { data };
  })
);

router.delete(
  "/ui-theme-presets/:id",
  validate({ params: idParamsSchema, query: ownerQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = idParamsSchema.parse(req.params);
    const query = ownerQuerySchema.parse(req.query);
    await deleteUiThemePreset({ ownerId: query.ownerId, presetId: params.id });
    return { data: { id: params.id } };
  })
);

router.get(
  "/ui-theme-presets/:id/export",
  validate({ params: idParamsSchema, query: ownerQuerySchema }),
  asyncHandler(async (req: Request) => {
    const params = idParamsSchema.parse(req.params);
    const query = ownerQuerySchema.parse(req.query);
    const data = await exportUiThemePreset({ ownerId: query.ownerId, presetId: params.id });
    return { data };
  })
);

const importBodySchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    items: z.union([uiThemeExportSchema, z.array(uiThemeExportSchema).min(1)]),
  })
  .strict();

router.post(
  "/ui-theme-presets/import",
  validate({ body: importBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = importBodySchema.parse(req.body);
    const rawItems = Array.isArray(body.items) ? body.items : [body.items];
    const created = await importUiThemePresets({
      ownerId: body.ownerId,
      items: rawItems,
    });
    return { data: { created } };
  })
);

router.get(
  "/ui-theme-settings",
  validate({ query: ownerQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = ownerQuerySchema.parse(req.query);
    const data = await getUiThemeSettings({ ownerId: query.ownerId });
    return { data };
  })
);

router.put(
  "/ui-theme-settings",
  validate({ body: uiThemeSettingsPatchSchema }),
  asyncHandler(async (req: Request) => {
    const body = uiThemeSettingsPatchSchema.parse(req.body);
    if (typeof body.activePresetId === "undefined" && typeof body.colorScheme === "undefined") {
      throw new HttpError(400, "Patch is empty", "VALIDATION_ERROR");
    }
    const data = await patchUiThemeSettings({
      ownerId: body.ownerId,
      activePresetId: body.activePresetId,
      colorScheme: body.colorScheme,
    });
    return { data };
  })
);

export { importBodySchema };
export default router;

