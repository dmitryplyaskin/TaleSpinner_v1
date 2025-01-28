import { AsyncRequestHandler } from "../common/middleware/async-handler";
import fileService from "@services/file-service";
import { v4 as uuidv4 } from "uuid";
import path from "path";

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

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".json": "application/json",
  };
  return contentTypes[ext] || "application/octet-stream";
}
