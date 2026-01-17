import path from "path";

import { DATA_PATH } from "./const";

export const createDataPath = (dir: string): string =>
  path.join(DATA_PATH, dir);
