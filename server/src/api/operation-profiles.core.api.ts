import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import {
  createOperationProfile,
  deleteOperationProfile,
  getOperationProfileById,
  listOperationProfiles,
  updateOperationProfile,
} from "../services/operations/operation-profiles-repository";
import {
  getOperationProfileSettings,
  setActiveOperationProfile,
} from "../services/operations/operation-profile-settings-repository";
import { validateOperationProfileImport } from "../services/operations/operation-profile-validator";

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
  asyncHandler(async () => {
    const items = await listOperationProfiles({ ownerId: "global" });
    return { data: items };
  })
);

router.post(
  "/operation-profiles",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createOperationProfile({
      ownerId: req.body.ownerId,
      input: req.body.input,
    });
    return { data: created };
  })
);

// ---- Active profile (global only)

router.get(
  "/operation-profiles/active",
  asyncHandler(async () => {
    const settings = await getOperationProfileSettings();
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
    if (body.activeProfileId !== null) {
      const exists = await getOperationProfileById(body.activeProfileId);
      if (!exists) {
        throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
      }
    }
    const updated = await setActiveOperationProfile({
      activeProfileId: body.activeProfileId,
    });
    return { data: updated };
  })
);

router.get(
  "/operation-profiles/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationProfileById(params.id);
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
      ownerId: req.body.ownerId,
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
    const exists = await getOperationProfileById(params.id);
    if (!exists) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    await deleteOperationProfile({ ownerId: "global", profileId: params.id });
    return { data: { id: params.id } };
  })
);

// ---- Import / export

router.get(
  "/operation-profiles/:id/export",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationProfileById(params.id);
    if (!item) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    return {
      data: {
        profileId: item.profileId,
        name: item.name,
        description: item.description,
        enabled: item.enabled,
        executionMode: item.executionMode,
        operationProfileSessionId: item.operationProfileSessionId,
        operations: item.operations,
        meta: item.meta ?? undefined,
      },
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
    const ownerId = req.body.ownerId ?? "global";
    const rawItems: unknown[] = Array.isArray(req.body.items)
      ? (req.body.items as unknown[])
      : [req.body.items as unknown];

    const created = [];
    for (const raw of rawItems) {
      const validated = validateOperationProfileImport(raw);
      const profile = await createOperationProfile({
        ownerId,
        input: validated,
      });
      created.push(profile);
    }
    return { data: { created } };
  })
);

export default router;

