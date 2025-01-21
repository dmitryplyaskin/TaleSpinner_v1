const express = require("express");
const router = express.Router();
const imageService = require("../services/image-service");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB максимальный размер файла
  },
  fileFilter: (req, file, cb) => {
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

// Загрузка изображения
router.post("/upload", upload.single("image"), async (req, res) => {
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
      details: error.message,
    });
  }
});

// Получение изображения
router.get("/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!(await imageService.imageExists(filename))) {
      return res.status(404).json({ error: "Изображение не найдено" });
    }

    const image = await imageService.getImage(filename);

    // Определяем тип контента на основе расширения файла
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
      details: error.message,
    });
  }
});

// Удаление изображения
router.delete("/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!(await imageService.imageExists(filename))) {
      return res.status(404).json({ error: "Изображение не найдено" });
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
      details: error.message,
    });
  }
});

module.exports = router;
