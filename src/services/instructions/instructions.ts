import { BaseService } from "@core/services/base-service";
import { InstructionType } from "@shared/types/instructions";
import { promises as fs } from "fs";
import path from "path";

class Instructions extends BaseService<InstructionType> {
  private readonly storageDir: string;

  constructor() {
    super("instructions");
    this.storageDir = path.join(process.cwd(), "data", "instructions");
  }

  async init() {
    await fs.mkdir(this.storageDir, { recursive: true });
  }

  async getAll(): Promise<InstructionType[]> {
    const files = await fs.readdir(this.storageDir);
    const instructions = await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(
          path.join(this.storageDir, file),
          "utf-8"
        );
        return JSON.parse(content);
      })
    );
    return instructions;
  }

  async getById(id: string): Promise<InstructionType> {
    try {
      const content = await fs.readFile(
        path.join(this.storageDir, `${id}.json`),
        "utf-8"
      );
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Instruction with id ${id} not found`);
    }
  }

  async create(data: InstructionType): Promise<InstructionType> {
    await fs.writeFile(
      path.join(this.storageDir, `${data.id}.json`),
      JSON.stringify(data, null, 2)
    );
    return data;
  }

  async update(id: string, data: InstructionType): Promise<InstructionType> {
    await fs.writeFile(
      path.join(this.storageDir, `${id}.json`),
      JSON.stringify(data, null, 2)
    );
    return data;
  }

  async delete(id: string): Promise<void> {
    await fs.unlink(path.join(this.storageDir, `${id}.json`));
  }
}

export default new Instructions();
