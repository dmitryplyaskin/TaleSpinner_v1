import fs from "fs/promises";
import path from "path";
import { createDataPath } from "../../utils";
import { BaseEntity, Logger, ServiceOptions } from "@core/types/common";
import { v4 as uuidv4 } from "uuid";

export class BaseService<T extends BaseEntity> {
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

  protected getFilePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  protected async readEntity(id: string): Promise<T> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      this.logger?.error("Failed to read entity", { id, error });
      throw error;
    }
  }

  protected async writeEntity(id: string, data: T): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger?.error("Failed to write entity", { id, error });
      throw error;
    }
  }

  protected async deleteEntity(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger?.error("Failed to delete entity", { id, error });
      throw error;
    }
  }

  async getAll(): Promise<T[]> {
    try {
      const files = await fs.readdir(this.dir);
      const jsonFiles = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""));

      const entities = await Promise.all(
        jsonFiles.map((id) => this.readEntity(id))
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

  async getById(id: string): Promise<T> {
    return await this.readEntity(id);
  }

  async create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    try {
      const now = new Date().toISOString();
      const entity = {
        ...data,
        id: this.createUUID(),
        createdAt: now,
        updatedAt: now,
      } as T;

      await this.writeEntity(entity.id, entity);
      return entity;
    } catch (error) {
      this.logger?.error("Failed to create entity", { data, error });
      throw error;
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const existing = await this.getById(id);
      const updated = {
        ...existing,
        ...data,
        id,
        updatedAt: new Date().toISOString(),
      };

      await this.writeEntity(id, updated);
      return updated;
    } catch (error) {
      this.logger?.error("Failed to update entity", { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.deleteEntity(id);
  }

  async duplicate(id: string): Promise<T> {
    try {
      const existing = await this.getById(id);
      const duplicated = {
        ...existing,
        id: this.createUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as T;

      await this.writeEntity(duplicated.id, duplicated);
      return duplicated;
    } catch (error) {
      this.logger?.error("Failed to duplicate entity", { id, error });
      throw error;
    }
  }
}
