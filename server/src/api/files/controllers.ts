import fileService from "@services/file-service";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";
import fs from "fs/promises";
import { CardUploadResponse, ProcessedCardFile, UploadedFile } from "./types";
import { AsyncRequestHandler } from "@core/middleware/async-handler";

interface CharacterComment {
  keyword: string;
  text: string;
}

function findCharacterData(metadata: sharp.Metadata): string | null {
  if (!metadata.comments || !Array.isArray(metadata.comments)) {
    return null;
  }

  const charaComment = metadata.comments.find(
    (comment: CharacterComment) => comment.keyword === "chara" && comment.text
  );

  if (!charaComment) {
    return null;
  }

  try {
    const decodedText = Buffer.from(charaComment.text, "base64").toString(
      "utf-8"
    );
    return decodedText;
  } catch (error) {
    console.error("Error decoding base64:", error);
    return null;
  }
}

export const uploadFiles: AsyncRequestHandler = async (req) => {
  if (!req.files || !Array.isArray(req.files)) {
    throw new Error("Файлы не были загружены");
  }

  const uploadedFiles = await Promise.all(
    req.files.map(async (file) => {
      const fileExtension = path.extname(file.originalname);
      const filename = `${uuidv4()}${fileExtension}`;
      await fileService.saveFile(file.buffer, filename);
      return {
        originalName: file.originalname,
        filename: filename,
        size: file.size,
        mimetype: file.mimetype,
      };
    })
  );

  return {
    data: {
      files: uploadedFiles,
      message: "Файлы успешно загружены",
    },
  };
};

export const getFile: AsyncRequestHandler = async (req) => {
  const filenameParam = req.params.filename;
  const filename = Array.isArray(filenameParam) ? filenameParam[0] : filenameParam;

  if (!filename) {
    throw new Error("filename обязателен");
  }

  if (!(await fileService.fileExists(filename))) {
    throw new Error("Файл не найден");
  }

  const file = await fileService.getFile(filename);
  return {
    data: file,
    headers: {
      "Content-Type": getContentType(filename),
    },
    raw: true,
  };
};

export const getFileMetadata: AsyncRequestHandler = async (req) => {
  const filenameParam = req.params.filename;
  const filename = Array.isArray(filenameParam) ? filenameParam[0] : filenameParam;

  if (!filename) {
    throw new Error("filename обязателен");
  }

  if (!(await fileService.fileExists(filename))) {
    throw new Error("Файл не найден");
  }

  if (!filename.toLowerCase().endsWith(".png")) {
    throw new Error("Метаданные доступны только для PNG файлов");
  }

  const metadata = await fileService.getPngMetadata(filename);
  return { data: metadata };
};

export const deleteFile: AsyncRequestHandler = async (req) => {
  const filenameParam = req.params.filename;
  const filename = Array.isArray(filenameParam) ? filenameParam[0] : filenameParam;

  if (!filename) {
    throw new Error("filename обязателен");
  }

  if (!(await fileService.fileExists(filename))) {
    throw new Error("Файл не найден");
  }

  await fileService.deleteFile(filename);
  return {
    data: {
      message: "Файл успешно удален",
    },
  };
};

export const uploadCards: AsyncRequestHandler = async (req) => {
  if (!req.files || !Array.isArray(req.files)) {
    throw new Error("Файлы не были загружены");
  }

  const processedFiles: ProcessedCardFile[] = [];
  const failedFiles: Array<{ originalName: string; error: string }> = [];

  const cardImagesPath = path.join(
    process.cwd(),
    "data",
    "media",
    "images",
    "agent-cards"
  );
  await fs.mkdir(cardImagesPath, { recursive: true });

  for (const file of req.files) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const filename = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(cardImagesPath, filename);

      if (fileExtension === ".png") {
        const image = sharp(file.buffer);
        const metadata = await image.metadata();

        // Проверяем наличие данных character-карточки
        const characterData = findCharacterData(metadata);
        if (!characterData) {
          throw new Error("PNG файл не содержит данных character-карточки");
        }

        await fs.writeFile(filePath, file.buffer);

        processedFiles.push({
          originalName: file.originalname,
          filename,
          path: `/media/images/agent-cards/${filename}`,
          characterData: [JSON.parse(characterData)],
          metadata: {
            ...metadata,
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || "unknown",
          },
          type: "png",
        });
      } else if (fileExtension === ".json") {
        // Заглушка для JSON файлов
        await fs.writeFile(filePath, file.buffer);
        processedFiles.push({
          originalName: file.originalname,
          filename,
          path: `/media/images/agent-cards/${filename}`,
          metadata: {
            width: 0,
            height: 0,
            format: "json",
          },
          type: "json",
        });
      }
    } catch (error) {
      failedFiles.push({
        originalName: file.originalname,
        error: (error as Error).message,
      });
    }
  }

  return {
    data: {
      processedFiles,
      failedFiles,
      message:
        processedFiles.length > 0
          ? "Файлы успешно обработаны"
          : "Не удалось обработать файлы",
    } as CardUploadResponse,
  };
};

export const uploadImage: AsyncRequestHandler = async (req) => {
  if (!req.file) {
    throw new Error("Изображение не было загружено");
  }

  const folderName = req.body.folder || "default";
  const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9-_]/g, "_");

  const imageFolder = path.join(
    process.cwd(),
    "data",
    "media",
    "images",
    sanitizedFolderName
  );

  // Создаем папку, если она не существует
  await fs.mkdir(imageFolder, { recursive: true });

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error("Неподдерживаемый формат изображения");
  }

  const filename = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(imageFolder, filename);

  // Сохраняем файл
  await fs.writeFile(filePath, req.file.buffer);

  const uploadedFile: UploadedFile = {
    originalName: req.file.originalname,
    filename: filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  };

  return {
    data: {
      file: uploadedFile,
      path: `/media/images/${sanitizedFolderName}/${filename}`,
      message: "Изображение успешно загружено",
    },
  };
};

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };
  return contentTypes[ext] || "application/octet-stream";
}
