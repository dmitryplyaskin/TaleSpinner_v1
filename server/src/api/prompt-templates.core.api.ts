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
  buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../services/chat-core/prompt-template-context";
import {
  renderLiquidTemplate,
  validateLiquidTemplate,
} from "../services/chat-core/prompt-template-renderer";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateById,
  listPromptTemplates,
  updatePromptTemplate,
} from "../services/chat-core/prompt-templates-repository";

const router = express.Router();

const idParamsSchema = z.object({ id: idSchema });
const prerenderBodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  templateText: z.string().min(1),
  chatId: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  entityProfileId: z.string().min(1).optional(),
  historyLimit: z.number().int().min(1).max(200).optional(),
});

router.get(
  "/prompt-templates",
  validate({ query: listPromptTemplatesQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = listPromptTemplatesQuerySchema.parse(req.query);
    const templates = await listPromptTemplates({
      ownerId: query.ownerId ?? "global",
    });
    return { data: templates };
  })
);

router.post(
  "/prompt-templates/prerender",
  validate({ body: prerenderBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = prerenderBodySchema.parse(req.body);
    try {
      validateLiquidTemplate(body.templateText);
    } catch (error) {
      throw new HttpError(
        400,
        `Template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
        "VALIDATION_ERROR"
      );
    }

    const context = await buildPromptTemplateRenderContext({
      ownerId: body.ownerId ?? "global",
      chatId: body.chatId,
      branchId: body.branchId,
      entityProfileId: body.entityProfileId,
      historyLimit: body.historyLimit ?? 50,
    });
    await resolveAndApplyWorldInfoToTemplateContext({
      context,
      ownerId: body.ownerId ?? "global",
      chatId: body.chatId,
      branchId: body.branchId,
      entityProfileId: body.entityProfileId,
      trigger: "generate",
      dryRun: true,
    });

    const rendered = await renderLiquidTemplate({
      templateText: body.templateText,
      context,
    });

    return { data: { rendered } };
  })
);

router.post(
  "/prompt-templates",
  validate({ body: createPromptTemplateBodySchema }),
  asyncHandler(async (req: Request) => {
    try {
      validateLiquidTemplate(req.body.templateText);
    } catch (error) {
      throw new HttpError(
        400,
        `Template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
        "VALIDATION_ERROR"
      );
    }

    const created = await createPromptTemplate({
      ownerId: req.body.ownerId,
      name: req.body.name,
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
    if (typeof req.body.templateText === "string") {
      try {
        validateLiquidTemplate(req.body.templateText);
      } catch (error) {
        throw new HttpError(
          400,
          `Template не компилируется: ${error instanceof Error ? error.message : String(error)}`,
          "VALIDATION_ERROR"
        );
      }
    }

    const updated = await updatePromptTemplate({
      id: params.id,
      name: req.body.name,
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
