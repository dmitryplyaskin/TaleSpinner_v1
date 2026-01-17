import fs from "fs/promises";
import path from "path";

import sharp from "sharp";

class FileService {
  private fileDirectory: string;

  constructor() {
    this.fileDirectory = path.join(process.cwd(), "data", "files");
    this.initFileDirectory();
  }

  private async initFileDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.fileDirectory, { recursive: true });
    } catch (error) {
      console.error("Ошибка при создании директории для файлов:", error);
    }
  }

  async saveFile(fileBuffer: Buffer, filename: string): Promise<string> {
    const filePath = path.join(this.fileDirectory, filename);
    await fs.writeFile(filePath, fileBuffer);
    return filename;
  }

  async getFile(filename: string): Promise<Buffer> {
    const filePath = path.join(this.fileDirectory, filename);
    return await fs.readFile(filePath);
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.fileDirectory, filename);
    await fs.unlink(filePath);
  }

  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.fileDirectory, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getPngMetadata(filename: string): Promise<sharp.Metadata> {
    const filePath = path.join(this.fileDirectory, filename);
    const image = sharp(filePath);
    return await image.metadata();
  }
}

export default new FileService();
