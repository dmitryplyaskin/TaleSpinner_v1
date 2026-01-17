import express, { type Request } from "express";

import { asyncHandler } from "@core/middleware/async-handler";

import openRouterService from "../services/open-router-service";

const router = express.Router();

router.get(
  "/models",
  asyncHandler(async (_req: Request) => {
    const models = await openRouterService.getModels();
    return { data: models };
  })
);

export default router;
