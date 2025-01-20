const express = require("express");
const router = express.Router();
const sidebarsService = require("../services/sidebars-service");

router.get("/sidebars", async (req, res) => {
  try {
    const settings = await sidebarsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sidebars", async (req, res) => {
  try {
    const settings = await sidebarsService.saveSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
