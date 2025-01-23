import express, { Request, Response } from "express";
import openRouterService from "../services/open-router-service";

const router = express.Router();

router.get("/config/openrouter", (_req: Request, res: Response) => {
  try {
    const config = openRouterService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/config/openrouter", (req: Request, res: Response) => {
  try {
    openRouterService.updateConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
