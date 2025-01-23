import { createDataPath } from "../utils";
import fileService from "./file-service";
import fs from "fs";
import path from "path";
import { UserPerson } from "../types";

const DIR_NAME = "user-person";

interface UserPersonSettings {
  selectedUserPersonId: string | null;
  isUserPersonEnabled: boolean;
}

class UserPersonService {
  private dir: string;

  constructor() {
    this.dir = createDataPath(DIR_NAME);
    this.ensureUserPersonDirectory();
  }

  private ensureUserPersonDirectory(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  async getUserPersonList(): Promise<UserPerson[]> {
    try {
      const files = await fileService.getFileList(this.dir, ".json");
      const data: UserPerson[] = [];

      for await (const file of files) {
        const filePath = path.join(this.dir, file);
        const userPerson = await fileService.readJson<UserPerson>(filePath);
        data.push(userPerson);
      }

      return data;
    } catch (error) {
      console.error("Ошибка при чтении списка персон:", error);
      throw error;
    }
  }

  async getUserPerson(id: string): Promise<UserPerson> {
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      return await fileService.readJson<UserPerson>(filePath);
    } catch (error) {
      console.error(`Ошибка при чтении персоны ${id}:`, error);
      throw error;
    }
  }

  async saveUserPerson(userPerson: UserPerson): Promise<void> {
    try {
      const filePath = path.join(this.dir, `${userPerson.id}.json`);
      await fileService.saveFile(filePath, JSON.stringify(userPerson));
    } catch (error) {
      console.error("Ошибка при сохранении персоны:", error);
      throw error;
    }
  }

  async deleteUserPerson(id: string): Promise<void> {
    try {
      const filePath = path.join(this.dir, `${id}.json`);
      await fileService.deleteFile(filePath);
    } catch (error) {
      console.error(`Ошибка при удалении персоны ${id}:`, error);
      throw error;
    }
  }

  async getUserPersonSettings(): Promise<UserPersonSettings> {
    try {
      const filePath = path.join(this.dir, ".settings.json");
      if (!fs.existsSync(filePath)) {
        const defaultSettings: UserPersonSettings = {
          selectedUserPersonId: null,
          isUserPersonEnabled: false,
        };
        await fileService.saveFile(filePath, JSON.stringify(defaultSettings));
        return defaultSettings;
      }
      return await fileService.readJson<UserPersonSettings>(filePath);
    } catch (error) {
      console.error("Ошибка при чтении настроек персон:", error);
      throw error;
    }
  }

  async saveUserPersonSettings(settings: UserPersonSettings): Promise<void> {
    try {
      const filePath = path.join(this.dir, ".settings.json");
      await fileService.saveFile(filePath, JSON.stringify(settings));
    } catch (error) {
      console.error("Ошибка при сохранении настроек персон:", error);
      throw error;
    }
  }
}

export default new UserPersonService();
