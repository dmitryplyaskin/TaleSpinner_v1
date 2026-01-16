import express, { Request, Response } from "express";
import appSettingsService from "../services/app-settings.service";
import { AppSettings } from "@shared/types/app-settings";

const router = express.Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await appSettingsService.getConfig();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await appSettingsService.updateConfig(
      req.body as Partial<AppSettings>
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
