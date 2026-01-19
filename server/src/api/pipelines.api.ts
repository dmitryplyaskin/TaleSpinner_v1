import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { createPipelineBodySchema, idSchema, updatePipelineBodySchema } from "../chat-core/schemas";
import {
  createPipeline,
  deletePipeline,
  getPipelineById,
  listPipelines,
  updatePipeline,
} from "../services/chat-core/pipelines-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

router.get(
  "/pipelines",
  asyncHandler(async () => {
    const items = await listPipelines({ ownerId: "global" });
    return { data: items };
  })
);

router.post(
  "/pipelines",
  validate({ body: createPipelineBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createPipeline({
      ownerId: req.body.ownerId,
      name: req.body.name,
      enabled: req.body.enabled,
      definition: req.body.definition,
    });
    return { data: created };
  })
);

router.get(
  "/pipelines/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const item = await getPipelineById(params.id);
    if (!item) throw new HttpError(404, "Pipeline не найден", "NOT_FOUND");
    return { data: item };
  })
);

router.put(
  "/pipelines/:id",
  validate({ params: idParamsSchema, body: updatePipelineBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updatePipeline({
      id: params.id,
      name: req.body.name,
      enabled: req.body.enabled,
      definition: typeof req.body.definition === "undefined" ? undefined : req.body.definition,
    });
    if (!updated) throw new HttpError(404, "Pipeline не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/pipelines/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getPipelineById(params.id);
    if (!exists) throw new HttpError(404, "Pipeline не найден", "NOT_FOUND");
    await deletePipeline(params.id);
    return { data: { id: params.id } };
  })
);

export default router;
