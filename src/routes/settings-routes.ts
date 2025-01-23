import express, { Request, Response } from "express";
import settingsService from "../services/settings-service";
import { Settings } from "../types";

const router = express.Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await settingsService.saveSettings(req.body as Settings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
