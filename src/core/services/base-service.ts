import fs from "fs/promises";
import path from "path";
import { createDataPath } from "../../utils";
import { BaseEntity, Logger, ServiceOptions } from "@core/types/common";
import { v4 as uuidv4 } from "uuid";

export abstract class BaseService<T extends BaseEntity> {
  protected readonly dir: string;
  protected readonly logger?: Logger;

  constructor(dirName: string, options?: ServiceOptions) {
    this.dir = options?.dataDir || createDataPath(dirName);
    this.logger = options?.logger;
    this.ensureDirectory();
  }

  protected async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
    } catch (error) {
      this.logger?.error("Failed to create directory", {
        dir: this.dir,
        error,
      });
      throw error;
    }
  }

  protected createUUID(): string {
    return uuidv4();
  }

  protected getFilePath(name: string): string {
    return path.join(this.dir, name);
  }

  protected getJSONPath(name: string): string {
    return path.join(this.dir, `${name}.json`);
  }

  protected async readJson<R>(filePath: string): Promise<R> {
    try {
      const content = await fs.readFile(`${filePath}.json`, "utf8");
      return JSON.parse(content);
    } catch (error) {
      this.logger?.error("Failed to read JSON file", { filePath, error });
      throw error;
    }
  }

  protected async writeJson<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.writeFile(`${filePath}.json`, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger?.error("Failed to write JSON file", { filePath, error });
      throw error;
    }
  }

  protected async deleteJson(filePath: string): Promise<void> {
    try {
      await fs.unlink(`${filePath}.json`);
    } catch (error) {
      this.logger?.error("Failed to delete JSON file", { filePath, error });
      throw error;
    }
  }

  async getAllJSON(): Promise<T[]> {
    try {
      const files = await fs.readdir(this.dir);
      const jsonFiles = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""));

      const entities = await Promise.all(
        jsonFiles.map((file) => this.readJson<T>(path.join(this.dir, file)))
      );

      return entities.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      this.logger?.error("Failed to get all entities", { error });
      throw error;
    }
  }

  async getJSONById(id: string): Promise<T> {
    try {
      return await this.readJson<T>(this.getFilePath(id));
    } catch (error) {
      this.logger?.error("Failed to get entity by id", { id, error });
      throw error;
    }
  }

  async createJSON(
    data: Omit<T, "id" | "createdAt" | "updatedAt">
  ): Promise<T> {
    try {
      const now = new Date().toISOString();
      const entity = {
        ...data,
        id: this.createUUID(),
        createdAt: now,
        updatedAt: now,
      } as T;

      await this.writeJson(this.getFilePath(entity.id), entity);
      return entity;
    } catch (error) {
      this.logger?.error("Failed to create entity", { data, error });
      throw error;
    }
  }

  async updateJSON(id: string, data: Partial<T>): Promise<T> {
    try {
      const existing = await this.getJSONById(id);
      const updated = {
        ...existing,
        ...data,
        id,
        updatedAt: new Date().toISOString(),
      };

      await this.writeJson(this.getFilePath(id), updated);
      return updated;
    } catch (error) {
      this.logger?.error("Failed to update entity", { id, data, error });
      throw error;
    }
  }

  async deleteJSON(id: string): Promise<void> {
    try {
      await fs.unlink(this.getFilePath(id));
    } catch (error) {
      this.logger?.error("Failed to delete entity", { id, error });
      throw error;
    }
  }

  async duplicateJSON(
    id: string,
    newName: string = this.createUUID()
  ): Promise<T> {
    try {
      const existing = await this.getJSONById(id);
      console.log(existing);
      const duplicated = {
        ...existing,
        id: this.createUUID(),
        timestamp: new Date().toISOString(),
      };
      await this.createJSON(duplicated);
      return duplicated;
    } catch (error) {
      this.logger?.error("Failed to duplicate entity", { id, newName, error });
      throw error;
    }
  }
}
