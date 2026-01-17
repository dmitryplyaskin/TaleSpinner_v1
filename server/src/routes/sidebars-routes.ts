import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

import sidebarsService from "../services/sidebars-service";
import { type SidebarState } from "../types";

const router = express.Router();

const sidebarSettingsSchema = z.object({
  isOpen: z.boolean(),
  isFullscreen: z.boolean(),
  placement: z.string(),
  size: z.string(),
  contained: z.boolean(),
});

const sidebarsSchema = z.object({
  settings: sidebarSettingsSchema,
  chatCards: sidebarSettingsSchema,
  userPersons: sidebarSettingsSchema,
  pipeline: sidebarSettingsSchema,
  instructions: sidebarSettingsSchema,
}) satisfies z.ZodType<SidebarState>;

router.get(
  "/sidebars",
  asyncHandler(async () => {
    const settings = await sidebarsService.getSettings();
    return { data: settings };
  })
);

router.post(
  "/sidebars",
  validate({ body: sidebarsSchema }),
  asyncHandler(async (req: Request) => {
    const settings = await sidebarsService.saveSettings(
      req.body as SidebarState
    );
    return { data: settings };
  })
);

export default router;
