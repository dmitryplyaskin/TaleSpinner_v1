// services/files/file.service.js

const fs = require("fs").promises;

class FileService {
  /**
   * Сохраняет файл по указанному пути.
   * @param {string} filePath - Полный путь к файлу.
   * @param {string} content - Содержимое файла.
   * @returns {Promise<void>}
   */
  async saveFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content, "utf8");
      console.log(`Файл успешно сохранен: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Читает содержимое файла.
   * @param {string} filePath - Полный путь к файлу.
   * @returns {Promise<string>} - Содержимое файла.
   */
  async readFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Читает содержимое файла в формате JSON.
   * @param {string} filePath - Полный путь к файлу.
   * @returns {Promise<object>} - Объект, содержащий содержимое файла в формате JSON.
   */

  async readJson(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Получает список файлов в указанном каталоге.
   * @param {string} filePath - Полный путь к каталогу.
   * @param {string} fileType - Тип файлов, которые нужно получить (опционально).
   * @returns {Promise<string[]>} - Список файлов в каталоге.
   */

  async getFileList(filePath, fileType) {
    try {
      const files = await fs.readdir(filePath);
      if (fileType) {
        return files.filter((file) => file.endsWith(fileType));
      }
      return files;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Изменяет содержимое файла.
   * @param {string} filePath - Полный путь к файлу.
   * @param {string} newContent - Новое содержимое файла.
   * @returns {Promise<void>}
   */
  async updateFile(filePath, newContent) {
    try {
      await fs.writeFile(filePath, newContent, "utf8");
      console.log(`Файл успешно обновлен: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при обновлении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Удаляет файл.
   * @param {string} filePath - Полный путь к файлу.
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`Файл успешно удален: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Проверяет существование файла.
   * @param {string} filePath - Полный путь к файлу.
   * @returns {Promise<boolean>} - True, если файл существует, иначе false.
   */
  async existsFile(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Переименовывает файл.
   * @param {string} oldPath - Старый путь к файлу.
   * @param {string} newPath - Новый путь к файлу.
   * @returns {Promise<void>}
   */
  async renameFile(oldPath, newPath) {
    try {
      await fs.rename(oldPath, newPath);
      console.log(`Файл успешно переименован из ${oldPath} в ${newPath}`);
    } catch (error) {
      console.error(
        `Ошибка при переименовании файла из ${oldPath} в ${newPath}:`,
        error
      );
      throw error;
    }
  }

  // Другие методы работы с файлами (создание директорий, получение информации о файле и т.д.)
}

module.exports = new FileService();
