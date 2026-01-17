import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";

import { routes } from "./api/_routes_";
import staticRouter from "./api/static.api";
import { errorHandler } from "./core/middleware/error-handler";
import { initDb } from "./db/client";
import appSettingsRoutes from "./routes/app-settings-routes";
import generateRoutes from "./routes/generate-routes";
import modelsRoutes from "./routes/models-routes";
import settingsRoutes from "./routes/settings-routes";
import sidebarsRoutes from "./routes/sidebars-routes";
import { bootstrapLlm } from "./services/llm/llm-bootstrap";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(morgan("dev"));
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve static files
app.use(express.static("public"));

// API Routes
app.use(staticRouter);
app.use("/api", routes);
app.use("/api", modelsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/app-settings", appSettingsRoutes);
app.use("/api", generateRoutes);
app.use("/api", sidebarsRoutes);

// Errors (must be last)
app.use(errorHandler(console));

async function main(): Promise<void> {
  await initDb();
  await bootstrapLlm();

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Server bootstrap failed:", error);
  process.exitCode = 1;
});
