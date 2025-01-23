import express, { Request, Response } from "express";
import sidebarsService from "../services/sidebars-service";

const router = express.Router();

interface SidebarSettings {
  isOpen: boolean;
  isFullscreen: boolean;
  placement: string;
  size: string;
  contained: boolean;
}

interface SidebarState {
  settings: SidebarSettings;
  chatCards: SidebarSettings;
  userPersons: SidebarSettings;
}

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
