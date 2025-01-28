import express, { Request, Response } from "express";
import sidebarsService from "../services/sidebars-service";
import { SidebarState } from "../types";

const router = express.Router();

router.get("/sidebars", async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await sidebarsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/sidebars", async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await sidebarsService.saveSettings(
      req.body as SidebarState
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
