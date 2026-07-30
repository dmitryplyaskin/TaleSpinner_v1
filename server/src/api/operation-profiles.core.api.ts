import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { exportOperationProfileBundle } from "../application/operations/use-cases/export-operation-profile";
import { importOperationProfiles } from "../application/operations/use-cases/import-operation-profiles";
import { setActiveOperationProfileWithValidation } from "../application/operations/use-cases/set-active-operation-profile";
import { idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import { getRequestOwnerId } from "../core/request-context/request-context";
import { getOperationProfileSettings } from "../services/operations/operation-profile-settings-repository";
import {
  createOperationProfile,
  deleteOperationProfile,
  getOperationProfileById,
  listOperationProfiles,
  updateOperationProfile,
} from "../services/operations/operation-profiles-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

const createBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  input: jsonValueSchema,
});

const updateBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  patch: jsonValueSchema,
});

router.get(
  "/operation-profiles",
  asyncHandler(async (req: Request) => {
    const items = await listOperationProfiles({ ownerId: getRequestOwnerId(req) });
    return { data: items };
  })
);

router.post(
  "/operation-profiles",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createOperationProfile({
      ownerId: getRequestOwnerId(req, req.body.ownerId),
      input: req.body.input,
    });
    return { data: created };
  })
);

// ---- Active profile (global only)

router.get(
  "/operation-profiles/active",
  asyncHandler(async (req: Request) => {
    const settings = await getOperationProfileSettings({
      ownerId: getRequestOwnerId(req),
    });
    return { data: settings };
  })
);

const setActiveBodySchema = z.object({
  activeProfileId: idSchema.nullable(),
});

router.put(
  "/operation-profiles/active",
  validate({ body: setActiveBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = setActiveBodySchema.parse(req.body);
    return {
      data: await setActiveOperationProfileWithValidation({
        ownerId: getRequestOwnerId(req),
        activeProfileId: body.activeProfileId,
      }),
    };
  })
);

router.get(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationProfileById({
      ownerId: getRequestOwnerId(req),
      profileId: params.id,
    });
    if (!item) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updateOperationProfile({
      ownerId: getRequestOwnerId(req, req.body.ownerId),
      profileId: params.id,
      patch: req.body.patch,
    });
    if (!updated) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getOperationProfileById({
      ownerId: getRequestOwnerId(req),
      profileId: params.id,
    });
    if (!exists) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    await deleteOperationProfile({ ownerId: getRequestOwnerId(req), profileId: params.id });
    return { data: { id: params.id } };
  })
);

// ---- Import / export

router.get(
  "/operation-profiles/:id/export",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    return {
      data: await exportOperationProfileBundle({
        ownerId: getRequestOwnerId(req),
        profileId: params.id,
      }),
    };
  })
);

const importBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  items: z.union([jsonValueSchema, z.array(jsonValueSchema)]),
});

router.post(
  "/operation-profiles/import",
  validate({ body: importBodySchema }),
  asyncHandler(async (req: Request) => {
    const rawItems: unknown[] = Array.isArray(req.body.items)
      ? (req.body.items as unknown[])
      : [req.body.items as unknown];
    return {
      data: await importOperationProfiles({
        ownerId: getRequestOwnerId(req, req.body.ownerId),
        items: rawItems,
      }),
    };
  })
);

export default router;

