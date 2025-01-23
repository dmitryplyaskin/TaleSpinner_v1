import fs from "fs/promises";

class FileService {
  async saveFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      await fs.writeFile(filePath, content);
      console.log(`Файл успешно сохранен: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return content;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  async readJson<T>(filePath: string): Promise<T> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  async getFileList(filePath: string, fileType?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(filePath);
      if (fileType) {
        return files.filter((file) => file.endsWith(fileType));
      }
      return files;
    } catch (error) {
      console.error(`Ошибка при чтении директории ${filePath}:`, error);
      throw error;
    }
  }

  async updateFile(filePath: string, newContent: string): Promise<void> {
    try {
      await fs.writeFile(filePath, newContent, "utf8");
      console.log(`Файл успешно обновлен: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при обновлении файла ${filePath}:`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`Файл успешно удален: ${filePath}`);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${filePath}:`, error);
      throw error;
    }
  }

  async existsFile(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
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
}

export default new FileService();
