const express = require('express');
const progress = require('../progress');

const router = express.Router();

// POST /api/students — "Start / Resume". Creates the student on first
// contact, or returns their existing saved progress if they already exist.
router.post('/', (req, res) => {
  const { registration_number: registrationNumber } = req.body || {};
  const normalized = progress.normalizeRegNumber(registrationNumber);

  if (!normalized) {
    return res.status(400).json({ error: 'Registration number is required.' });
  }
  if (normalized.length > 50) {
    return res.status(400).json({ error: 'Registration number is too long.' });
  }

  const data = progress.getStudentProgress(normalized);
  res.json(data);
});

// GET /api/students/:reg — used on page refresh to reload saved progress.
router.get('/:reg', (req, res) => {
  const data = progress.loadStudentProgress(req.params.reg);
  if (!data) {
    return res.status(404).json({ error: 'Registration number not found.' });
  }
  res.json(data);
});

module.exports = router;
