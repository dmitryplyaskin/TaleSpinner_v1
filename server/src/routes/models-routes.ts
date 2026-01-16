import express, { Request, Response } from "express";
import openRouterService from "../services/open-router-service";

const router = express.Router();

router.get("/models", async (_req: Request, res: Response): Promise<void> => {
  try {
    const models = await openRouterService.getModels();
    res.json(models);
  } catch (error) {
    console.error("Error getting models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

export default router;
