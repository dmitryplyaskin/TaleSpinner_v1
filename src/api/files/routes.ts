import express from "express";
import multer from "multer";
import { asyncHandler } from "../common/middleware/async-handler";
import * as controllers from "./controllers";
import path from "path";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /png|json/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Поддерживаются только файлы форматов PNG и JSON!"));
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

router
  .route("/files/:filename")
  .get(asyncHandler(controllers.getFile))
  .delete(asyncHandler(controllers.deleteFile));

router.get(
  "/files/metadata/:filename",
  asyncHandler(controllers.getFileMetadata)
);

export default router;
