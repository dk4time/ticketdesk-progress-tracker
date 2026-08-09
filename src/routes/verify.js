const express = require('express');
const progress = require('../progress');
const { requireGradingKey } = require('../gradingAuth');

const router = express.Router();

function isValidResultEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!progress.isValidCategory(entry.category)) return false;
  if (!Number.isInteger(entry.itemNumber) || !progress.isValidItemNumber(entry.category, entry.itemNumber)) {
    return false;
  }
  return typeof entry.passed === 'boolean';
}

// POST /api/verify — the only way item_completions can change now that the
// student-facing checkboxes are gone. Called by `npm run self-check` in the
// TicketDesk repo (see grading/self-check.js there); reject silently-wrong
// payloads with 400 rather than crashing, since this runs unattended from
// 100+ students' laptops over classroom WiFi.
router.post('/', requireGradingKey, (req, res) => {
  const { registrationNumber, results } = req.body || {};
  const normalized = progress.normalizeRegNumber(registrationNumber);

  if (!normalized) {
    return res.status(400).json({ error: 'registrationNumber is required.' });
  }
  // An empty array is a legitimate report, not a malformed one — a student
  // whose backend/frontend didn't even start yet gets 0 testable items on a
  // run, and that "nothing tested" result must still land here (registering
  // the student so their status page shows "Not tested yet" instead of
  // 404), never silently dropped for looking sparse.
  if (!Array.isArray(results)) {
    return res.status(400).json({ error: 'results must be an array.' });
  }
  if (!results.every(isValidResultEntry)) {
    return res.status(400).json({ error: 'Each result entry needs a valid category, itemNumber, and boolean passed.' });
  }

  try {
    const data = progress.applyVerifiedResults(normalized, results);
    res.json({ ok: true, registration_number: normalized, counts: data.counts });
  } catch (err) {
    console.error('POST /api/verify failed:', err);
    res.status(400).json({ error: 'Could not record results.' });
  }
});

module.exports = router;
