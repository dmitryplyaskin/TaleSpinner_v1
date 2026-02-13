import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import {
  createInstructionBodySchema,
  idSchema,
  listInstructionsQuerySchema,
  updateInstructionBodySchema,
} from "../chat-core/schemas";
import {
  buildInstructionRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../services/chat-core/prompt-template-context";
import {
  renderLiquidTemplate,
  validateLiquidTemplate,
} from "../services/chat-core/prompt-template-renderer";
import {
  createInstruction,
  deleteInstruction,
  getInstructionById,
  listInstructions,
  updateInstruction,
} from "../services/chat-core/instructions-repository";

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
  "/instructions",
  validate({ query: listInstructionsQuerySchema }),
  asyncHandler(async (req: Request) => {
    const query = listInstructionsQuerySchema.parse(req.query);
    const instructions = await listInstructions({
      ownerId: query.ownerId ?? "global",
    });
    return { data: instructions };
  })
);

router.post(
  "/instructions/prerender",
  validate({ body: prerenderBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = prerenderBodySchema.parse(req.body);
    try {
      validateLiquidTemplate(body.templateText);
    } catch (error) {
      throw new HttpError(
        400,
        `Instruction не компилируется: ${error instanceof Error ? error.message : String(error)}`,
        "VALIDATION_ERROR"
      );
    }

    const context = await buildInstructionRenderContext({
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
  "/instructions",
  validate({ body: createInstructionBodySchema }),
  asyncHandler(async (req: Request) => {
    try {
      validateLiquidTemplate(req.body.templateText);
    } catch (error) {
      throw new HttpError(
        400,
        `Instruction не компилируется: ${error instanceof Error ? error.message : String(error)}`,
        "VALIDATION_ERROR"
      );
    }

    const created = await createInstruction({
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
  "/instructions/:id",
  validate({ params: idParamsSchema, body: updateInstructionBodySchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    if (typeof req.body.templateText === "string") {
      try {
        validateLiquidTemplate(req.body.templateText);
      } catch (error) {
        throw new HttpError(
          400,
          `Instruction не компилируется: ${error instanceof Error ? error.message : String(error)}`,
          "VALIDATION_ERROR"
        );
      }
    }

    const updated = await updateInstruction({
      id: params.id,
      name: req.body.name,
      engine: req.body.engine,
      templateText: req.body.templateText,
      meta: typeof req.body.meta === "undefined" ? undefined : req.body.meta,
    });
    if (!updated)
      throw new HttpError(404, "Instruction не найден", "NOT_FOUND");
    return { data: updated };
  })
);

router.delete(
  "/instructions/:id",
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const exists = await getInstructionById(params.id);
    if (!exists)
      throw new HttpError(404, "Instruction не найден", "NOT_FOUND");
    await deleteInstruction(params.id);
    return { data: { id: params.id } };
  })
);

export default router;
