import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempDataDir(prefix = "talespinner-e2e-"): Promise<string> {
  const base = path.join(os.tmpdir(), prefix);
  return fs.mkdtemp(base);
}

export async function removeTempDataDir(dir: string): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== "EBUSY" && code !== "EPERM") || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}
