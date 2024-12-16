const express = require('express');
const router = express.Router();
const openRouterService = require('../services/openRouterService');

// Получение конфигурации OpenRouter
router.get('/config/openrouter', (req, res) => {
  try {
    const config = openRouterService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление конфигурации OpenRouter
router.post('/config/openrouter', (req, res) => {
  try {
    openRouterService.updateConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
