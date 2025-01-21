const fileService = require("./file-service");
const path = require("path");
const fs = require("fs").promises;

class ImageService {
  constructor() {
    this.imageDirectory = path.join(process.cwd(), "data", "images");
    this.initImageDirectory();
  }

  async initImageDirectory() {
    try {
      await fs.mkdir(this.imageDirectory, { recursive: true });
    } catch (error) {
      console.error("Ошибка при создании директории для изображений:", error);
    }
  }

  /**
   * Сохраняет изображение в файловой системе
   * @param {Buffer} imageBuffer - Буфер с данными изображения
   * @param {string} filename - Имя файла
   * @returns {Promise<string>} - Путь к сохраненному файлу
   */
  async saveImage(imageBuffer, filename) {
    const imagePath = path.join(this.imageDirectory, filename);
    await fileService.saveFile(imagePath, imageBuffer);
    return filename;
  }

  /**
   * Получает изображение из файловой системы
   * @param {string} filename - Имя файла
   * @returns {Promise<Buffer>} - Буфер с данными изображения
   */
  async getImage(filename) {
    const imagePath = path.join(this.imageDirectory, filename);
    return await fs.readFile(imagePath);
  }

  /**
   * Удаляет изображение из файловой системы
   * @param {string} filename - Имя файла
   * @returns {Promise<void>}
   */
  async deleteImage(filename) {
    const imagePath = path.join(this.imageDirectory, filename);
    await fileService.deleteFile(imagePath);
  }

  /**
   * Проверяет существование изображения
   * @param {string} filename - Имя файла
   * @returns {Promise<boolean>}
   */
  async imageExists(filename) {
    const imagePath = path.join(this.imageDirectory, filename);
    return await fileService.existsFile(imagePath);
  }
}

module.exports = new ImageService();
