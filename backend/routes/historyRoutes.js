const express = require('express');
const router = express.Router();
const History = require('../models/History');

// GET /history -> Get up to 5 most recently organized folders
router.get('/', async (req, res) => {
  try {
    const history = await History.find()
      .sort({ lastOrganizedAt: -1 })
      .limit(5);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
});

// DELETE /history/:id -> Delete a specific history item
router.delete('/:id', async (req, res) => {
  try {
    await History.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'History item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting history item', error: error.message });
  }
});

module.exports = router;
