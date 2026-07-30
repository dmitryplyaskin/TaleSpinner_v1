import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { deleteOperationBlockWithValidation } from "../application/operations/use-cases/delete-operation-block";
import { importOperationBlocks } from "../application/operations/use-cases/import-operation-blocks";
import { idSchema, jsonValueSchema, ownerIdSchema } from "../chat-core/schemas";
import { getRequestOwnerId } from "../core/request-context/request-context";
import {
  createOperationBlock,
  getOperationBlockById,
  listOperationBlocks,
  updateOperationBlock,
} from "../services/operations/operation-blocks-repository";

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
  asyncHandler(async (req: Request) => {
    const items = await listOperationBlocks({ ownerId: getRequestOwnerId(req) });
    return { data: items };
  })
);

router.post(
  "/operation-blocks",
  validate({ body: createBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createOperationBlock({
      ownerId: getRequestOwnerId(req, req.body.ownerId),
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
    const item = await getOperationBlockById({
      ownerId: getRequestOwnerId(req),
      blockId: params.id,
    });
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
      ownerId: getRequestOwnerId(req, req.body.ownerId),
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
    return {
      data: await deleteOperationBlockWithValidation({
        ownerId: getRequestOwnerId(req),
        blockId: params.id,
      }),
    };
  })
);

router.get(
  "/operation-blocks/:id/export",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getOperationBlockById({
      ownerId: getRequestOwnerId(req),
      blockId: params.id,
    });
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
    const rawItems: unknown[] = Array.isArray(req.body.items)
      ? (req.body.items as unknown[])
      : [req.body.items as unknown];
    return {
      data: await importOperationBlocks({
        ownerId: getRequestOwnerId(req, req.body.ownerId),
        items: rawItems,
      }),
    };
  })
);

export default router;
