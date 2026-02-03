import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { abortGeneration } from "../services/chat-core/generation-runtime";

const router = express.Router();

const abortParamsSchema = z.object({
  id: z.string().min(1), // generationId
});

router.post(
  "/generations/:id/abort",
  validate({ params: abortParamsSchema }),
  asyncHandler(async (req: Request) => {
    const id = String((req.params as unknown as { id: string }).id);
    const ok = abortGeneration(id);
    if (!ok) {
      throw new HttpError(404, "Generation not found or not active", "NOT_FOUND");
    }
    return { data: { success: true } };
  })
);

export default router;

