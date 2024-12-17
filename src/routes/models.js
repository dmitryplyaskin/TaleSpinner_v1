const express = require('express');
const router = express.Router();
const openRouterService = require('../services/openRouterService');

router.get('/models', async (req, res) => {
  try {
    const models = await openRouterService.getModels();
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

module.exports = router;
