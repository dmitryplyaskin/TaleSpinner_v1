import path from "path";

import express from "express";
import multer from "multer";

import { asyncHandler } from "@core/middleware/async-handler";

import * as controllers from "./controllers";

const router = express.Router();

const allowedMimesByExtension: Record<string, readonly string[]> = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".svg": ["image/svg+xml"],
  ".json": ["application/json", "text/json"],
};

function normalizeMimeType(mimeType: string): string {
  return String(mimeType ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim();
}

export function isAllowedFileType(params: {
  originalName: string;
  mimeType: string;
}): boolean {
  const ext = path.extname(params.originalName).toLowerCase();
  const allowedMimes = allowedMimesByExtension[ext];
  if (!allowedMimes) return false;
  return allowedMimes.includes(normalizeMimeType(params.mimeType));
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedFileType({ originalName: file.originalname, mimeType: file.mimetype })) {
      return cb(null, true);
    }
    cb(new Error("Unsupported file type"));
  },
});

router.post(
  "/files/upload",
  upload.array("files", 10),
  asyncHandler(controllers.uploadFiles)
);

router.post(
  "/files/upload-card",
  upload.array("files", 10),
  asyncHandler(controllers.uploadCards)
);

router.post(
  "/files/upload-image",
  upload.single("image"),
  asyncHandler(controllers.uploadImage)
);

router.get(
  "/files/metadata/:filename",
  asyncHandler(controllers.getFileMetadata)
);

router
  .route("/files/:filename")
  .get(asyncHandler(controllers.getFile))
  .delete(asyncHandler(controllers.deleteFile));

export default router;
