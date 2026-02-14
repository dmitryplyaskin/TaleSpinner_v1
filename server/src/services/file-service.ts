import fs from "fs/promises";

import sharp from "sharp";

import { resolveSafePath } from "@core/files/safe-path";

import { createDataPath } from "../utils";

class FileService {
  private readonly fileDirectory: string;
  private readonly ready: Promise<void>;

  constructor() {
    this.fileDirectory = createDataPath("files");
    this.ready = this.initFileDirectory();
  }

  private async initFileDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.fileDirectory, { recursive: true });
    } catch (error) {
      console.error("Ошибка при создании директории для файлов:", error);
    }
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private resolveFilePath(filename: string): string {
    return resolveSafePath(this.fileDirectory, filename);
  }

  async saveFile(fileBuffer: Buffer, filename: string): Promise<string> {
    await this.ensureReady();
    const filePath = this.resolveFilePath(filename);
    await fs.writeFile(filePath, fileBuffer);
    return filename;
  }

  async getFile(filename: string): Promise<Buffer> {
    await this.ensureReady();
    const filePath = this.resolveFilePath(filename);
    return await fs.readFile(filePath);
  }

  async deleteFile(filename: string): Promise<void> {
    await this.ensureReady();
    const filePath = this.resolveFilePath(filename);
    await fs.unlink(filePath);
  }

  async fileExists(filename: string): Promise<boolean> {
    await this.ensureReady();
    const filePath = this.resolveFilePath(filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getPngMetadata(filename: string): Promise<sharp.Metadata> {
    await this.ensureReady();
    const filePath = this.resolveFilePath(filename);
    const image = sharp(filePath);
    return await image.metadata();
  }
}

export default new FileService();
