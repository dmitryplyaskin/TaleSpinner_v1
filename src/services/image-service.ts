import fileService from "./file-service";
import path from "path";
import fs from "fs/promises";

class ImageService {
  private imageDirectory: string;

  constructor() {
    this.imageDirectory = path.join(process.cwd(), "data", "images");
    this.initImageDirectory();
  }

  private async initImageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.imageDirectory, { recursive: true });
    } catch (error) {
      console.error("Ошибка при создании директории для изображений:", error);
    }
  }

  async saveImage(imageBuffer: Buffer, filename: string): Promise<string> {
    const imagePath = path.join(this.imageDirectory, filename);
    await fileService.saveFile(imagePath, imageBuffer);
    return filename;
  }

  async getImage(filename: string): Promise<Buffer> {
    const imagePath = path.join(this.imageDirectory, filename);
    return await fs.readFile(imagePath);
  }

  async deleteImage(filename: string): Promise<void> {
    const imagePath = path.join(this.imageDirectory, filename);
    await fileService.deleteFile(imagePath);
  }

  async imageExists(filename: string): Promise<boolean> {
    const imagePath = path.join(this.imageDirectory, filename);
    return await fileService.existsFile(imagePath);
  }
}

export default new ImageService();
