import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import configRoutes from "./routes/config-routes";
import modelsRoutes from "./routes/models-routes";
import settingsRoutes from "./routes/settings-routes";
import generateRoutes from "./routes/generate-routes";
import sidebarsRoutes from "./routes/sidebars-routes";
import { routes } from "./api/routes";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static("public"));

// API Routes
app.use("/api", routes);
app.use("/api", configRoutes);
app.use("/api", modelsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", generateRoutes);
app.use("/api", sidebarsRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
