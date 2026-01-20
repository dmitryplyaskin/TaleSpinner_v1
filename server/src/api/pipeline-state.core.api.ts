import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { chatIdParamsSchema, idSchema } from "../chat-core/schemas";
import { getChatById } from "../services/chat-core/chats-repository";
import { getChatPipelineState } from "../services/chat-core/pipeline-state";

const router = express.Router();

router.get(
  "/chats/:id/pipeline-state",
  validate({
    params: chatIdParamsSchema,
    query: z.object({ branchId: idSchema.optional() }),
  }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const query = req.query as unknown as { branchId?: string };
    const chat = await getChatById(params.id);
    if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

    const state = await getChatPipelineState({ chatId: params.id, branchId: query.branchId });
    return { data: state };
  })
);

export default router;

