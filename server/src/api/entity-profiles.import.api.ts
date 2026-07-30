import path from "path";

import express, { type Request } from "express";
import multer from "multer";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { normalizeCharSpec } from "../chat-core/charspec/normalize";
import { extractCharSpecFromPngBuffer } from "../chat-core/charspec/png";
import { saveEntityProfileAvatarPng } from "../services/chat-core/entity-profile-media";
import {
  createEntityProfile,
  type EntityProfileDto,
} from "../services/chat-core/entity-profiles-repository";

type ImportFailed = { originalName: string; error: string };

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".png" || ext === ".json") return cb(null, true);
    cb(new Error("Поддерживаются только файлы PNG и JSON"));
  },
});

function safeJsonParseBuffer(buffer: Buffer): unknown {
  const text = buffer.toString("utf-8");
  return JSON.parse(text) as unknown;
}

router.post(
  "/entity-profiles/import",
  upload.array("files", 10),
  asyncHandler(async (req: Request) => {
    if (!req.files || !Array.isArray(req.files)) {
      throw new HttpError(400, "Файлы не были загружены", "VALIDATION_ERROR");
    }

    const ownerId = resolveTrustedOwnerId();

    const created: EntityProfileDto[] = [];
    const failed: ImportFailed[] = [];

    for (const file of req.files) {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        let rawSpec: unknown;
        let avatarUrlPath: string | null = null;

        if (ext === ".png") {
          avatarUrlPath = await saveEntityProfileAvatarPng(file.buffer);
          rawSpec = await extractCharSpecFromPngBuffer(file.buffer);
        } else if (ext === ".json") {
          rawSpec = safeJsonParseBuffer(file.buffer);
        } else {
          throw new Error("Неподдерживаемый тип файла");
        }

        const normalized = normalizeCharSpec(rawSpec);

        const fallbackName =
          path.parse(file.originalname).name || "Imported profile";
        const name =
          normalized.name.trim().length > 0
            ? normalized.name.trim()
            : fallbackName;

        const profile = await createEntityProfile({
          ownerId,
          name,
          kind: "CharSpec",
          spec: { ...normalized, name },
          meta: {
            import: {
              originalName: file.originalname,
              fileType: ext.slice(1),
              source: normalized.source,
            },
          },
          avatarAssetId: avatarUrlPath ?? undefined,
        });

        created.push(profile);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ originalName: file.originalname, error: message });
      }
    }

    const message =
      created.length > 0
        ? `Импортировано профилей: ${created.length}`
        : "Не удалось импортировать ни одного профиля";

    return { data: { created, failed, message } };
  })
);

export default router;
