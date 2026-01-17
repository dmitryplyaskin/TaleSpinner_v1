import express, { type Request } from "express";

import { asyncHandler } from "@core/middleware/async-handler";

import { getRuntime } from "../services/llm/llm-repository";
import { getModels } from "../services/llm/llm-service";

const router = express.Router();

router.get(
  "/models",
  asyncHandler(async (_req: Request) => {
    const runtime = await getRuntime("global", "global");
    const models = await getModels({
      providerId: runtime.activeProviderId,
      scope: "global",
      scopeId: "global",
    });
    return { data: models };
  })
);

export default router;
