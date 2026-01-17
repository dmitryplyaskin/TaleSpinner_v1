import express, { Request, Response } from "express";
import openRouterService from "../services/open-router-service";
import { asyncHandler } from "@core/middleware/async-handler";

const router = express.Router();

router.get(
  "/models",
  asyncHandler(async (_req: Request) => {
    const models = await openRouterService.getModels();
    return { data: models };
  })
);

export default router;
