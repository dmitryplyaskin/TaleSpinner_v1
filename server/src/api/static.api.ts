import path from "path";

import express from "express";

const router = express.Router();

// Конфигурация для разных типов файлов
const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// Добавляем middleware для статических файлов
router.use(
  "/media",
  express.static(path.join(process.cwd(), "data", "media"), {
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      console.log(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = mimeTypes[ext];
      if (mimeType) {
        res.setHeader("Content-Type", mimeType);
      }
    },
  })
);

export default router;
