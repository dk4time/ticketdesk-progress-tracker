const express = require('express');
const progress = require('../progress');

const router = express.Router();

// POST /api/students — "Start / Resume". Creates the student on first
// contact, or returns their existing saved progress if they already exist.
router.post('/', async (req, res) => {
  const { registration_number: registrationNumber } = req.body || {};
  const normalized = progress.normalizeRegNumber(registrationNumber);

  if (!normalized) {
    return res.status(400).json({ error: 'Registration number is required.' });
  }
  if (normalized.length > 50) {
    return res.status(400).json({ error: 'Registration number is too long.' });
  }

  try {
    const data = await progress.getStudentProgress(normalized);
    res.json(data);
  } catch (err) {
    console.error('POST /api/students failed:', err);
    res.status(500).json({ error: 'Could not load progress.' });
  }
});

// GET /api/students/:reg — used on page refresh to reload saved progress.
router.get('/:reg', async (req, res) => {
  try {
    const data = await progress.loadStudentProgress(req.params.reg);
    if (!data) {
      return res.status(404).json({ error: 'Registration number not found.' });
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/students/:reg failed:', err);
    res.status(500).json({ error: 'Could not load progress.' });
  }
});

module.exports = router;
