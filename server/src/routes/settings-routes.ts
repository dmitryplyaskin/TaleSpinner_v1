import express, { Request, Response } from "express";
import { z } from "zod";
import settingsService from "../services/settings-service";
import { Settings } from "../types";
import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

const router = express.Router();

const settingsSchema = z.object({
  temperature: z.number(),
  maxTokens: z.number().int(),
  topP: z.number(),
  frequencyPenalty: z.number(),
  presencePenalty: z.number(),
}) satisfies z.ZodType<Settings>;

router.get(
  "/",
  asyncHandler(async () => {
    const settings = await settingsService.getConfig();
    return { data: settings };
  })
);

router.post(
  "/",
  validate({ body: settingsSchema }),
  asyncHandler(async (req: Request) => {
    const settings = await settingsService.saveConfig(req.body as Settings);
    return { data: settings };
  })
);

export default router;
