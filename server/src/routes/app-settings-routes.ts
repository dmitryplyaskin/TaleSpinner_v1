import { type AppSettings } from "@shared/types/app-settings";
import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

import appSettingsService from "../services/app-settings.service";

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
