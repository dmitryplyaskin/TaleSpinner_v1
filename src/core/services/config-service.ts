import fs from "fs/promises";
import path from "path";
import { createDataPath } from "../../utils";
import { BaseConfig, Logger, ServiceOptions } from "@core/types/common";

export abstract class ConfigService<T extends BaseConfig> {
  protected readonly configPath: string;
  protected readonly logger?: Logger;

  constructor(fileName: string, options?: ServiceOptions) {
    const configDir = options?.dataDir || createDataPath("config");
    this.configPath = path.join(configDir, fileName);
    this.logger = options?.logger;
    this.ensureConfigDirectory();
  }

  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    } catch (error) {
      this.logger?.error("Failed to create config directory", { error });
      throw error;
    }
  }

  protected abstract getDefaultConfig(): T;

  async getConfig(): Promise<T> {
    try {
      const content = await fs.readFile(this.configPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.log("getConfig error", error);
      const defaultConfig = this.getDefaultConfig();
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    }
  }

  async saveConfig(config: T): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      this.logger?.error("Failed to save config", { error });
      throw error;
    }
  }

  async updateConfig(updates: Partial<T>): Promise<T> {
    const current = await this.getConfig();
    const updated = { ...current, ...updates };
    await this.saveConfig(updated);
    return updated;
  }
}
