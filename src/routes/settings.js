const express = require("express");
const router = express.Router();
const settingsService = require("../services/settingsService");

router.get("/", async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const settings = await settingsService.saveSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
