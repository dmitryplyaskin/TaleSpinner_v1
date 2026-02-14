import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  createUserPersonBodySchema,
  idSchema,
  updateUserPersonBodySchema,
  updateUserPersonsSettingsBodySchema,
} from "../chat-core/schemas";
import {
  createUserPerson,
  deleteUserPerson,
  getUserPersonById,
  getUserPersonsSettings,
  listUserPersons,
  updateUserPerson,
  updateUserPersonsSettings,
} from "../services/chat-core/user-persons-repository";

const router = express.Router();
const idParamsSchema = z.object({ id: idSchema });

router.get(
  "/user-persons",
  asyncHandler(async (req: Request) => {
    const ownerId =
      typeof req.query.ownerId === "string" && req.query.ownerId.length > 0
        ? req.query.ownerId
        : "global";
    const items = await listUserPersons({ ownerId });
    return { data: items };
  })
);

router.get(
  "/user-persons/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getUserPersonById(params.id);
    if (!item) throw new HttpError(404, "User person не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.post(
  "/user-persons",
  validate({ body: createUserPersonBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = createUserPersonBodySchema.parse(req.body);
    const created = await createUserPerson({
      id: body.id,
      ownerId: body.ownerId,
      name: body.name,
      prefix: body.prefix,
      avatarUrl: body.avatarUrl,
      // v1: only default persona in the “core” flow
      type: "default",
      contentTypeDefault: body.contentTypeDefault ?? "",
      contentTypeExtended: body.contentTypeExtended,
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      updatedAt: body.updatedAt ? new Date(body.updatedAt) : undefined,
    });
    return { data: created };
  })
);

router.put(
  "/user-persons/:id",
  validate({ params: idParamsSchema, body: updateUserPersonBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = updateUserPersonBodySchema.parse(req.body);
    const updated = await updateUserPerson({
      id: params.id,
      name: body.name,
      prefix: body.prefix,
      avatarUrl: body.avatarUrl,
      type: "default",
      contentTypeDefault: body.contentTypeDefault,
      contentTypeExtended: body.contentTypeExtended,
      updatedAt: body.updatedAt ? new Date(body.updatedAt) : undefined,
    });
    if (!updated) throw new HttpError(404, "User person не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/user-persons/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getUserPersonById(params.id);
    if (!exists) throw new HttpError(404, "User person не найден", "NOT_FOUND");
    await deleteUserPerson(params.id);
    return { data: { id: params.id } };
  })
);

router.get(
  "/settings/user-persons",
  asyncHandler(async (req: Request) => {
    const ownerId =
      typeof req.query.ownerId === "string" && req.query.ownerId.length > 0
        ? req.query.ownerId
        : "global";
    const settings = await getUserPersonsSettings({ ownerId });
    return { data: settings };
  })
);

router.post(
  "/settings/user-persons",
  validate({ body: updateUserPersonsSettingsBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = updateUserPersonsSettingsBodySchema.parse(req.body);
    const updated = await updateUserPersonsSettings({
      ownerId: body.ownerId,
      selectedId: body.selectedId,
      enabled: body.enabled,
      pageSize: body.pageSize,
      sortType: typeof body.sortType === "undefined" ? undefined : body.sortType,
    });
    return { data: updated };
  })
);

export default router;

