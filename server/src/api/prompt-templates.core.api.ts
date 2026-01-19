import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  createPromptTemplateBodySchema,
  idSchema,
  listPromptTemplatesQuerySchema,
  updatePromptTemplateBodySchema,
} from "../chat-core/schemas";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateById,
  listPromptTemplates,
  updatePromptTemplate,
} from "../services/chat-core/prompt-templates-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });

router.get(
  "/prompt-templates",
  validate({ query: listPromptTemplatesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = req.query as unknown as {
      scope: "global" | "entity_profile" | "chat";
      scopeId?: string;
    };
    const templates = await listPromptTemplates({
      ownerId: "global",
      scope: query.scope,
      scopeId: query.scopeId,
    });
    return { data: templates };
  })
);

router.post(
  "/prompt-templates",
  validate({ body: createPromptTemplateBodySchema }),
  asyncHandler(async (req: Request) => {
    const created = await createPromptTemplate({
      ownerId: req.body.ownerId,
      name: req.body.name,
      enabled: req.body.enabled,
      scope: req.body.scope,
      scopeId: req.body.scopeId,
      engine: req.body.engine,
      templateText: req.body.templateText,
      meta: req.body.meta,
    });
    return { data: created };
  })
);

router.put(
  "/prompt-templates/:id",
  validate({ params: idParamsSchema, body: updatePromptTemplateBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const updated = await updatePromptTemplate({
      id: params.id,
      name: req.body.name,
      enabled: req.body.enabled,
      scope: req.body.scope,
      scopeId:
        typeof req.body.scopeId === "undefined" ? undefined : req.body.scopeId,
      engine: req.body.engine,
      templateText: req.body.templateText,
      meta: typeof req.body.meta === "undefined" ? undefined : req.body.meta,
    });
    if (!updated)
      throw new HttpError(404, "PromptTemplate не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/prompt-templates/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getPromptTemplateById(params.id);
    if (!exists)
      throw new HttpError(404, "PromptTemplate не найден", "NOT_FOUND");
    await deletePromptTemplate(params.id);
    return { data: { id: params.id } };
  })
);

export default router;
