const { createDataPath } = require("../utils");
const fileService = require("./file-service");
const fs = require("fs");
const path = require("path");

const DIR_NAME = "user-person";

class UserPersonService {
  constructor() {
    this.dir = createDataPath(DIR_NAME);
    this.ensureUserPersonDirectory();
  }

  ensureUserPersonDirectory() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  /**
   * @returns {Promise<Object[]>} userPerson[]
   */

  async getUserPersonList() {
    try {
      const files = await fileService.getFileList(this.dir, ".json");
      const data = [];

      for await (const file of files) {
        const filePath = path.join(this.dir, file);
        const userPerson = await fileService.readJson(filePath);
        data.push(userPerson);
      }

      return data;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * @param {string} userPerson id
   * @returns {Promise<Object>} userPerson
   */

  async getUserPerson(id) {
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      const userPerson = await fileService.readJson(filePath);
      return userPerson;
    } catch (error) {
      console.error(`Ошибка при чтении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * @param {Object} userPerson
   */

  async saveUserPerson(userPerson) {
    try {
      const filePath = path.join(this.dir, `${userPerson.id}.json`);
      await fileService.saveFile(filePath, JSON.stringify(userPerson));
    } catch (error) {
      console.error(`Ошибка при сохранении файла ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * @param {string} userPerson id
   */

  async deleteUserPerson(id) {
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      await fileService.deleteFile(filePath);
    } catch (error) {
      console.error(`Ошибка при удалении файла ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new UserPersonService();
