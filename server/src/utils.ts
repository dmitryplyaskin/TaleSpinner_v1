import path from "path";

import { getDataRootPath } from "./const";

export const createDataPath = (...parts: string[]): string =>
  path.join(getDataRootPath(), ...parts);
