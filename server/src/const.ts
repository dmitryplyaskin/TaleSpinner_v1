import path from "path";

const DATA_ROOT_ENV = "TALESPINNER_DATA_DIR";

export function getDataRootPath(): string {
  const configured = process.env[DATA_ROOT_ENV]?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(__dirname, "../data");
}

export const DATA_PATH = getDataRootPath();
