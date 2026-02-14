import express, { type Express } from "express";
import cors from "cors";
import morgan from "morgan";
import { type Server } from "node:http";

import { routes } from "./api/_routes_";
import staticRouter from "./api/static.api";
import { errorHandler } from "./core/middleware/error-handler";
import { applyMigrations } from "./db/apply-migrations";
import { initDb } from "./db/client";
import { ensureInstructionsSchema } from "./db/ensure-instructions-schema";
import { ensureOperationBlocksCutover } from "./db/ensure-operation-blocks-cutover";
import appSettingsRoutes from "./routes/app-settings-routes";
import generateRoutes from "./routes/generate-routes";
import modelsRoutes from "./routes/models-routes";
import settingsRoutes from "./routes/settings-routes";
import sidebarsRoutes from "./routes/sidebars-routes";
import { bootstrapLlm } from "./services/llm/llm-bootstrap";
import { bootstrapRag } from "./services/rag.service";

export type BootstrapAppOptions = {
  dbPath?: string;
};

export async function bootstrapApp(options: BootstrapAppOptions = {}): Promise<void> {
  await initDb({ dbPath: options.dbPath });
  await applyMigrations();
  await ensureInstructionsSchema();
  await ensureOperationBlocksCutover();
  await bootstrapLlm();
  await bootstrapRag();
}

export function createApp(): Express {
  const app = express();

  app.use(morgan("dev"));
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use(express.static("public"));

  app.use(staticRouter);
  app.use("/api", routes);
  app.use("/api", modelsRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/app-settings", appSettingsRoutes);
  app.use("/api", generateRoutes);
  app.use("/api", sidebarsRoutes);

  app.use(errorHandler(console));

  return app;
}

export async function startAppServer(options: {
  port: number;
  dbPath?: string;
}): Promise<{ app: Express; server: Server }> {
  await bootstrapApp({ dbPath: options.dbPath });
  const app = createApp();

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(options.port, () => resolve(s));
  });

  return { app, server };
}
