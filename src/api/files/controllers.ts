import { AsyncRequestHandler } from "../common/middleware/async-handler";
import fileService from "@services/file-service";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";
import fs from "fs/promises";
import { CardUploadResponse, ProcessedCardFile } from "./types";

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
  const { filename } = req.params;

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
  const { filename } = req.params;

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
  const { filename } = req.params;

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
    "card-images"
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
          path: `/media/card-images/${filename}`,
          metadata: {
            ...metadata,
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || "unknown",
            // @ts-ignore
            customMetadata: {
              characterData: JSON.parse(characterData),
            },
          },
          type: "png",
        });
      } else if (fileExtension === ".json") {
        // Заглушка для JSON файлов
        await fs.writeFile(filePath, file.buffer);
        processedFiles.push({
          originalName: file.originalname,
          filename,
          path: `/media/card-images/${filename}`,
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

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".json": "application/json",
  };
  return contentTypes[ext] || "application/octet-stream";
}
