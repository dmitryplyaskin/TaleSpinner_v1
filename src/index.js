const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const chatRoutes = require("./routes/chat-routes");
const configRoutes = require("./routes/config-routes");
const modelsRoutes = require("./routes/models-routes");
const settingsRoutes = require("./routes/settings-routes");
const userPersonRoutes = require("./routes/user-persons-routes");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static("public"));

// API Routes
app.use("/api", chatRoutes);
app.use("/api", configRoutes);
app.use("/api", modelsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", userPersonRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
