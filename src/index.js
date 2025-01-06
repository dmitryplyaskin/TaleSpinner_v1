const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const chatRoutes = require('./routes/chatRoutes');
const configRoutes = require('./routes/configRoutes');
const modelsRoutes = require('./routes/models');
const settingsRoutes = require('./routes/settings');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// API Routes
app.use('/api', chatRoutes);
app.use('/api', configRoutes);
app.use('/api', modelsRoutes);
app.use('/api/settings', settingsRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});