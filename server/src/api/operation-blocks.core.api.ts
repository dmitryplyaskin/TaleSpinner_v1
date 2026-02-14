import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import {
  createOperationBlock,
  deleteOperationBlock,
  getOperationBlockById,
  listOperationBlocks,
  resolveImportedOperationBlockName,
  updateOperationBlock,
} from "../services/operations/operation-blocks-repository";
import { listOperationProfiles } from "../services/operations/operation-profiles-repository";
import { validateOperationBlockImport } from "../services/operations/operation-block-validator";

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
  "/operation-blocks",
  asyncHandler(async () => {
    const items = await listOperationBlocks({ ownerId: "global" });
    return { data: items };
  })
);

router.post(
  "/operation-blocks",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createOperationBlock({
      ownerId: req.body.ownerId,
      input: req.body.input,
    });
    return { data: created };
  })
);

router.get(
  "/operation-blocks/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationBlockById(params.id);
    if (!item) throw new HttpError(404, "OperationBlock не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/operation-blocks/:id",
  validate({ params: idParamsSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updateOperationBlock({
      ownerId: req.body.ownerId,
      blockId: params.id,
      patch: req.body.patch,
    });
    if (!updated) throw new HttpError(404, "OperationBlock не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/operation-blocks/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getOperationBlockById(params.id);
    if (!exists) throw new HttpError(404, "OperationBlock не найден", "NOT_FOUND");

    const profiles = await listOperationProfiles({ ownerId: "global" });
    const linked = profiles.find((profile) => profile.blockRefs.some((ref) => ref.blockId === params.id));
    if (linked) {
      throw new HttpError(400, "OperationBlock is used by profile", "VALIDATION_ERROR", {
        blockId: params.id,
        profileId: linked.profileId,
      });
    }

    await deleteOperationBlock({ ownerId: "global", blockId: params.id });
    return { data: { id: params.id } };
  })
);

router.get(
  "/operation-blocks/:id/export",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationBlockById(params.id);
    if (!item) throw new HttpError(404, "OperationBlock не найден", "NOT_FOUND");
    return {
      data: {
        blockId: item.blockId,
        name: item.name,
        description: item.description,
        enabled: item.enabled,
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
  "/operation-blocks/import",
  validate({ body: importBodySchema }),
  asyncHandler(async (req: Request) => {
    const ownerId = req.body.ownerId ?? "global";
    const rawItems: unknown[] = Array.isArray(req.body.items)
      ? (req.body.items as unknown[])
      : [req.body.items as unknown];

    const existing = await listOperationBlocks({ ownerId });
    const names = new Set(existing.map((item) => item.name));

    const created = [];
    for (const raw of rawItems) {
      const validated = validateOperationBlockImport(raw);
      const safeName = resolveImportedOperationBlockName(validated.name, Array.from(names));
      names.add(safeName);
      const block = await createOperationBlock({
        ownerId,
        input: {
          ...validated,
          name: safeName,
          meta: validated.meta,
        },
      });
      created.push(block);
    }
    return { data: { created } };
  })
);

export default router;
