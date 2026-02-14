import { once } from "node:events";
import { type AddressInfo } from "node:net";

import { type Server } from "node:http";

import { resetDbForTests } from "../../db/client";

export type RunningServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type InProcessOptions = {
  dataDir: string;
  tokensMasterKey: string;
};

function setTestEnv(options: InProcessOptions): void {
  process.env.TALESPINNER_DATA_DIR = options.dataDir;
  process.env.TOKENS_MASTER_KEY = options.tokensMasterKey;
}

export async function startInProcessServer(options: InProcessOptions): Promise<RunningServer> {
  setTestEnv(options);

  const appModule = await import("../../app");
  try {
    await appModule.bootstrapApp();
  } catch (error) {
    resetDbForTests();
    throw error;
  }
  const app = appModule.createApp();

  const server: Server = app.listen(0);
  await once(server, "listening");

  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      resetDbForTests();
    },
  };
}
