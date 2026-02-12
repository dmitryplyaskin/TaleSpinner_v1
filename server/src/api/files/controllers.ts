import fs from "fs/promises";
import path from "path";

import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { resolveSafePath } from "@core/files/safe-path";
import { type AsyncRequestHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import fileService from "@services/file-service";

import { type CardUploadResponse, type ProcessedCardFile, type UploadedFile } from "./types";

interface CharacterComment {
  keyword: string;
  text: string;
}

function readFilenameOrThrow(raw: unknown): string {
  const filename = Array.isArray(raw) ? raw[0] : raw;
  if (typeof filename !== "string" || filename.trim().length === 0) {
    throw new HttpError(400, "filename обязателен", "VALIDATION_ERROR");
  }
  return filename;
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
    throw new HttpError(400, "Файлы не были загружены", "VALIDATION_ERROR");
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
  const filename = readFilenameOrThrow(req.params.filename);

  if (!(await fileService.fileExists(filename))) {
    throw new HttpError(404, "Файл не найден", "NOT_FOUND");
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
  const filename = readFilenameOrThrow(req.params.filename);

  if (!(await fileService.fileExists(filename))) {
    throw new HttpError(404, "Файл не найден", "NOT_FOUND");
  }

  if (!filename.toLowerCase().endsWith(".png")) {
    throw new HttpError(
      415,
      "Метаданные доступны только для PNG файлов",
      "UNSUPPORTED_MEDIA_TYPE"
    );
  }

  const metadata = await fileService.getPngMetadata(filename);
  return { data: metadata };
};

export const deleteFile: AsyncRequestHandler = async (req) => {
  const filename = readFilenameOrThrow(req.params.filename);

  if (!(await fileService.fileExists(filename))) {
    throw new HttpError(404, "Файл не найден", "NOT_FOUND");
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
    throw new HttpError(400, "Файлы не были загружены", "VALIDATION_ERROR");
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
      const filePath = resolveSafePath(cardImagesPath, filename);

      if (fileExtension === ".png") {
        const image = sharp(file.buffer);
        const metadata = await image.metadata();

        // Проверяем наличие данных character-карточки
        const characterData = findCharacterData(metadata);
        if (!characterData) {
          throw new HttpError(
            422,
            "PNG файл не содержит данных character-карточки",
            "UNPROCESSABLE_ENTITY"
          );
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
    throw new HttpError(400, "Изображение не было загружено", "VALIDATION_ERROR");
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
    throw new HttpError(415, "Неподдерживаемый формат изображения", "UNSUPPORTED_MEDIA_TYPE");
  }

  const filename = `${uuidv4()}${fileExtension}`;
  const filePath = resolveSafePath(imageFolder, filename);

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
