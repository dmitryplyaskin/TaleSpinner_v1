import fs from "fs";

export abstract class BaseService {
  protected abstract readonly dir: string;

  protected async ensureDirectory(): Promise<void> {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  // protected getFilePath(filename: string): string {
  //   // общая логика формирования пути
  // }
}
