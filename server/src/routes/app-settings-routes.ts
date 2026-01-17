import express, { Request, Response } from "express";
import { z } from "zod";
import appSettingsService from "../services/app-settings.service";
import { AppSettings } from "@shared/types/app-settings";
import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

const router = express.Router();

const appSettingsPatchSchema = z
  .object({
    language: z.string().min(1).optional(),
    openLastChat: z.boolean().optional(),
    autoSelectCurrentPersona: z.boolean().optional(),
  })
  .passthrough();

router.get(
  "/",
  asyncHandler(async () => {
    const settings = await appSettingsService.getConfig();
    return { data: settings };
  })
);

router.post(
  "/",
  validate({ body: appSettingsPatchSchema }),
  asyncHandler(async (req: Request) => {
    const settings = await appSettingsService.updateConfig(
      req.body as Partial<AppSettings>
    );
    return { data: settings };
  })
);

export default router;
