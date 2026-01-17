import express, { Request, Response } from "express";
import { z } from "zod";
import openRouterService from "../services/open-router-service";
import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

const router = express.Router();

const openRouterConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1).optional(),
});

router.get(
  "/config/openrouter",
  asyncHandler((_req: Request) => {
    const config = openRouterService.getConfig();
    // Не светим ключ в UI/логах по умолчанию
    return { data: { ...config, apiKey: config.apiKey ? "***" : "" } };
  })
);

router.post(
  "/config/openrouter",
  validate({ body: openRouterConfigSchema }),
  asyncHandler((req: Request) => {
    openRouterService.updateConfig(req.body);
    return { data: { success: true } };
  })
);

export default router;
