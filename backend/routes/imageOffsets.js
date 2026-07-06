const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const offsetsFilePath = path.join(__dirname, '../../client/src/data/imageOffsets.json');

// Get current image offsets
router.get('/', (req, res) => {
  try {
    if (fs.existsSync(offsetsFilePath)) {
      const data = fs.readFileSync(offsetsFilePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json({});
    }
  } catch (err) {
    console.error('Failed to read image offsets:', err);
    res.status(500).json({ error: 'Failed to read image offsets' });
  }
});

// Update image offsets
router.post('/', (req, res) => {
  try {
    const data = req.body;
    // ensure the directory exists just in case
    const dir = path.dirname(offsetsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(offsetsFilePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to write image offsets:', err);
    res.status(500).json({ error: 'Failed to save image offsets' });
  }
});

module.exports = router;
