import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { getRequestOwnerId } from "../core/request-context/request-context";
import { scanSillyTavernImportRoot } from "../services/sillytavern-import/sillytavern-import-scanner";
import { importSillyTavernSelection } from "../services/sillytavern-import/sillytavern-importer";

const router = express.Router();

const scanBodySchema = z.object({
  rootPath: z.string().min(1),
});

const importBodySchema = z.object({
  rootPath: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  selection: z.object({
    itemIds: z.array(z.string().min(1)).max(10000),
  }),
});

function mapImportError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ENOENT") || message.includes("no such file")) {
    throw new HttpError(400, "SillyTavern data directory was not found.", "VALIDATION_ERROR");
  }
  throw error;
}

router.post(
  "/sillytavern-import/scan",
  validate({ body: scanBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = scanBodySchema.parse(req.body);
    try {
      return { data: await scanSillyTavernImportRoot(body.rootPath) };
    } catch (error) {
      mapImportError(error);
    }
  })
);

router.post(
  "/sillytavern-import/import",
  validate({ body: importBodySchema }),
  asyncHandler(async (req: Request) => {
    const body = importBodySchema.parse(req.body);
    try {
      return {
        data: await importSillyTavernSelection({
          rootPath: body.rootPath,
          ownerId: getRequestOwnerId(req, body.ownerId),
          selection: body.selection,
        }),
      };
    } catch (error) {
      mapImportError(error);
    }
  })
);

export default router;
