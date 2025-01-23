import express, { Request, Response, RequestHandler } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import imageService from "../services/image-service";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Поддерживаются только изображения (jpeg, jpg, png, gif)!"));
  },
});

// @ts-ignore
const handleImageUpload: RequestHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не был загружен" });
    }

    const fileExtension = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;

    await imageService.saveImage(req.file.buffer, filename);

    res.json({
      success: true,
      filename: filename,
      message: "Изображение успешно загружено",
    });
  } catch (error) {
    console.error("Ошибка при загрузке изображения:", error);
    res.status(500).json({
      error: "Ошибка при загрузке изображения",
      details: (error as Error).message,
    });
  }
};

router.post("/upload", upload.single("image"), handleImageUpload);

router.get("/:filename", async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!(await imageService.imageExists(filename))) {
      res.status(404).json({ error: "Изображение не найдено" });
      return;
    }

    const image = await imageService.getImage(filename);

    const ext = path.extname(filename).toLowerCase();
    const contentType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
      }[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.send(image);
  } catch (error) {
    console.error("Ошибка при получении изображения:", error);
    res.status(500).json({
      error: "Ошибка при получении изображения",
      details: (error as Error).message,
    });
  }
});

router.delete(
  "/:filename",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { filename } = req.params;

      if (!(await imageService.imageExists(filename))) {
        res.status(404).json({ error: "Изображение не найдено" });
        return;
      }

      await imageService.deleteImage(filename);

      res.json({
        success: true,
        message: "Изображение успешно удалено",
      });
    } catch (error) {
      console.error("Ошибка при удалении изображения:", error);
      res.status(500).json({
        error: "Ошибка при удалении изображения",
        details: (error as Error).message,
      });
    }
  }
);

export default router;
